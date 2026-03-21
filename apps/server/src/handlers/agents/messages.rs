use std::convert::Infallible;

use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use tokio_stream::StreamExt;
use futures_util::future::join_all;
use tracing::{info, warn};

use aura_core::{AgentId, AgentInstanceId, Message, ProjectId};
use aura_chat::ChatStreamEvent;
use aura_engine::EngineEvent;

use crate::channel_ext::send_or_log;
use crate::dto::SendMessageRequest;
use crate::error::ApiResult;
use crate::handlers::projects;
use crate::state::AppState;

use super::conversions::{get_user_id, storage_message_to_message};

/// Aggregate agent-level messages from aura-storage only (all project-agents for this agent_id -> sessions -> messages).
pub async fn aggregate_agent_messages_from_storage(
    state: &AppState,
    agent_id: &AgentId,
) -> Vec<Message> {
    let mut messages = Vec::new();
    let (Some(ref storage), Ok(jwt)) = (&state.storage_client, state.get_jwt()) else {
        return messages;
    };
    let all_projects = projects::list_all_projects_from_network(state)
        .await
        .unwrap_or_default();
    let agent_id_str = agent_id.to_string();

    let pids: Vec<String> = all_projects
        .iter()
        .map(|p| p.project_id.to_string())
        .collect();
    let agent_futs: Vec<_> = pids
        .iter()
        .map(|pid| storage.list_project_agents(pid, &jwt))
        .collect();
    let agent_results = join_all(agent_futs).await;

    let matching_agents: Vec<_> = agent_results
        .into_iter()
        .enumerate()
        .flat_map(|(i, result)| match result {
            Ok(agents) => agents
                .into_iter()
                .filter(|a| a.agent_id.as_deref() == Some(agent_id_str.as_str()))
                .collect::<Vec<_>>(),
            Err(e) => {
                warn!(project_id = %pids[i], error = %e, "Failed to list project agents");
                Vec::new()
            }
        })
        .collect();

    let session_futs: Vec<_> = matching_agents
        .iter()
        .map(|pa| storage.list_sessions(&pa.id, &jwt))
        .collect();
    let session_results = join_all(session_futs).await;

    let all_sessions: Vec<_> = session_results
        .into_iter()
        .enumerate()
        .flat_map(|(i, result)| match result {
            Ok(sessions) => sessions,
            Err(e) => {
                warn!(project_agent_id = %matching_agents[i].id, error = %e, "Failed to list sessions");
                Vec::new()
            }
        })
        .collect();

    let msg_futs: Vec<_> = all_sessions
        .iter()
        .map(|s| storage.list_messages(&s.id, &jwt, None, None))
        .collect();
    let msg_results = join_all(msg_futs).await;

    for (i, result) in msg_results.into_iter().enumerate() {
        match result {
            Ok(session_msgs) => {
                for sm in session_msgs.iter().filter(|sm| sm.role.as_deref() != Some("system")) {
                    messages.push(storage_message_to_message(sm));
                }
            }
            Err(e) => {
                warn!(session_id = %all_sessions[i].id, error = %e, "Failed to list messages");
            }
        }
    }
    messages.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    messages
}

pub async fn list_agent_messages(
    State(state): State<AppState>,
    Path(agent_id): Path<AgentId>,
) -> ApiResult<Json<Vec<Message>>> {
    let _ = state.require_storage_client()?;
    let _ = state.get_jwt()?;
    let messages = aggregate_agent_messages_from_storage(&state, &agent_id).await;
    Ok(Json(messages))
}

pub async fn send_agent_message_stream(
    State(state): State<AppState>,
    Path(agent_id): Path<AgentId>,
    Json(body): Json<SendMessageRequest>,
) -> ApiResult<Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>>> {
    super::super::billing::require_credits(&state).await?;
    info!(%agent_id, action = ?body.action, "Agent message stream requested");

    let agent = match get_user_id(&state) {
        Ok(uid) => state
            .agent_service
            .get_agent_async(&uid, &agent_id)
            .await
            .ok(),
        Err(_) => {
            warn!(%agent_id, "No authenticated user, cannot resolve agent");
            None
        }
    };

    let (storage_anchor, projects) = resolve_storage_anchor(&state, &agent_id).await;
    let messages = aggregate_agent_messages_from_storage(&state, &agent_id).await;

    let (tx, rx) = mpsc::unbounded_channel::<ChatStreamEvent>();

    let chat_service = state.chat_service.clone();
    let content = body.content;
    let action = body.action.clone();
    let attachments = body.attachments.unwrap_or_default();

    tokio::spawn(async move {
        if let Some(ref agent) = agent {
            chat_service
                .send_agent_message_streaming(
                    &agent_id, agent, &projects, messages,
                    &content, action.as_deref(), &attachments,
                    storage_anchor, tx,
                )
                .await;
        } else {
            send_or_log(&tx, ChatStreamEvent::Error("agent not found".to_string()));
            send_or_log(&tx, ChatStreamEvent::Done);
        }
    });

    let stream = UnboundedReceiverStream::new(rx).map(move |evt| {
        Ok(super::super::sse::chat_stream_event_to_sse(&evt))
    });

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

async fn resolve_storage_anchor(
    state: &AppState,
    agent_id: &AgentId,
) -> (Option<(ProjectId, AgentInstanceId)>, Vec<aura_core::Project>) {
    let (Some(ref storage), Ok(jwt)) = (&state.storage_client, state.get_jwt()) else {
        return (None, Vec::new());
    };
    let all_projects = projects::list_all_projects_from_network(state)
        .await
        .unwrap_or_default();
    let agent_id_str = agent_id.to_string();
    let mut storage_anchor = None;
    let mut matched = Vec::new();
    for project in all_projects {
        if let Ok(agents) = storage
            .list_project_agents(&project.project_id.to_string(), &jwt)
            .await
        {
            for a in &agents {
                if a.agent_id.as_deref() == Some(&agent_id_str) {
                    if storage_anchor.is_none() {
                        if let Ok(inst_id) = a.id.parse::<AgentInstanceId>() {
                            storage_anchor = Some((project.project_id, inst_id));
                        }
                    }
                    matched.push(project.clone());
                    break;
                }
            }
        }
    }
    (storage_anchor, matched)
}

pub async fn list_messages(
    State(state): State<AppState>,
    Path((_project_id, agent_instance_id)): Path<(ProjectId, AgentInstanceId)>,
) -> ApiResult<Json<Vec<Message>>> {
    let storage = state.require_storage_client()?;
    let jwt = state.get_jwt()?;

    let sessions = storage
        .list_sessions(&agent_instance_id.to_string(), &jwt)
        .await
        .unwrap_or_default();

    let mut messages = Vec::new();
    for session in &sessions {
        if let Ok(session_msgs) =
            storage.list_messages(&session.id, &jwt, None, None).await
        {
            for sm in session_msgs.iter().filter(|sm| sm.role.as_deref() != Some("system")) {
                messages.push(storage_message_to_message(sm));
            }
        }
    }
    messages.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(Json(messages))
}

pub async fn send_message_stream(
    State(state): State<AppState>,
    Path((project_id, agent_instance_id)): Path<(ProjectId, AgentInstanceId)>,
    Json(body): Json<SendMessageRequest>,
) -> ApiResult<Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>>> {
    super::super::billing::require_credits(&state).await?;
    info!(%project_id, %agent_instance_id, action = ?body.action, "Message stream requested");

    let agent_instance = state
        .agent_instance_service
        .get_instance(&project_id, &agent_instance_id)
        .await
        .ok();

    let (tx, rx) = mpsc::unbounded_channel::<ChatStreamEvent>();

    let chat_service = state.chat_service.clone();
    let pid = project_id;
    let aiid = agent_instance_id;
    let content = body.content;
    let action = body.action.clone();
    let attachments = body.attachments.unwrap_or_default();

    let is_generate_specs = body.action.as_deref() == Some("generate_specs");
    if is_generate_specs {
        send_or_log(&state.event_tx, EngineEvent::SpecGenStarted { project_id });
    }

    tokio::spawn(async move {
        if let Some(ref instance) = agent_instance {
            chat_service
                .send_message_streaming(
                    &pid, &aiid, instance, &content,
                    action.as_deref(), &attachments, tx,
                )
                .await;
        } else {
            send_or_log(&tx, ChatStreamEvent::Error("agent instance not found".to_string()));
            send_or_log(&tx, ChatStreamEvent::Done);
        }
    });

    let event_tx = state.event_tx.clone();
    let mut spec_count: usize = 0;

    let stream = UnboundedReceiverStream::new(rx).map(move |evt| {
        match &evt {
            ChatStreamEvent::SpecSaved(spec) => {
                spec_count += 1;
                send_or_log(&event_tx, EngineEvent::SpecSaved {
                    project_id,
                    spec: spec.clone(),
                });
            }
            ChatStreamEvent::Done => {
                if is_generate_specs {
                    send_or_log(&event_tx, EngineEvent::SpecGenCompleted {
                        project_id,
                        spec_count,
                    });
                }
            }
            _ => {}
        }
        Ok(super::super::sse::chat_stream_event_to_sse(&evt))
    });

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
