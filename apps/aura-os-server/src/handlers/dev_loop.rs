use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use tracing::info;

use aura_os_core::{AgentInstanceId, HarnessMode, ProjectId, TaskId};
use aura_os_link::{HarnessInbound, HarnessOutbound, SessionConfig, UserMessage};

use crate::dto::LoopStatusResponse;
use crate::error::{ApiError, ApiResult};
use crate::state::{ActiveHarnessSession, AppState};

#[derive(Debug, Deserialize, Default)]
pub(crate) struct LoopQueryParams {
    pub agent_instance_id: Option<AgentInstanceId>,
}

/// Broadcast a synthetic domain event as JSON on the global event channel.
fn emit_domain_event(
    broadcast_tx: &tokio::sync::broadcast::Sender<serde_json::Value>,
    event_type: &str,
    project_id: ProjectId,
    agent_instance_id: AgentInstanceId,
    extra: serde_json::Value,
) {
    let mut event = serde_json::json!({
        "type": event_type,
        "project_id": project_id.to_string(),
        "agent_instance_id": agent_instance_id.to_string(),
    });
    if let (Some(base), Some(ext)) = (event.as_object_mut(), extra.as_object()) {
        for (k, v) in ext {
            base.insert(k.clone(), v.clone());
        }
    }
    let _ = broadcast_tx.send(event);
}

/// Forward typed harness events to the global broadcast, enriching each with
/// project/agent context. Also emits synthetic domain events:
/// - `task_started` on the first `AssistantMessageStart`
/// - `loop_finished` when the harness session closes
fn forward_harness_events(
    events_tx: &tokio::sync::broadcast::Sender<HarnessOutbound>,
    raw_events_tx: &tokio::sync::broadcast::Sender<serde_json::Value>,
    broadcast_tx: tokio::sync::broadcast::Sender<serde_json::Value>,
    project_id: ProjectId,
    agent_instance_id: AgentInstanceId,
) {
    let mut typed_rx = events_tx.subscribe();
    let mut raw_rx = raw_events_tx.subscribe();
    let bc = broadcast_tx.clone();
    let pid = project_id.to_string();
    let aiid = agent_instance_id.to_string();

    tokio::spawn(async move {
        let mut first_message_seen = false;
        loop {
            tokio::select! {
                result = typed_rx.recv() => {
                    match result {
                        Ok(event) => {
                            if !first_message_seen {
                                if matches!(event, HarnessOutbound::AssistantMessageStart(_)) {
                                    first_message_seen = true;
                                    emit_domain_event(
                                        &bc,
                                        "task_started",
                                        project_id,
                                        agent_instance_id,
                                        serde_json::json!({}),
                                    );
                                }
                            }
                            let mut json = serde_json::to_value(&event).unwrap_or_default();
                            if let Some(obj) = json.as_object_mut() {
                                obj.insert("project_id".into(), serde_json::Value::String(pid.clone()));
                                obj.insert("agent_instance_id".into(), serde_json::Value::String(aiid.clone()));
                            }
                            let _ = bc.send(json);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            emit_domain_event(
                                &bc,
                                "loop_finished",
                                project_id,
                                agent_instance_id,
                                serde_json::json!({}),
                            );
                            break;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    }
                }
                result = raw_rx.recv() => {
                    match result {
                        Ok(mut value) => {
                            if let Some(obj) = value.as_object_mut() {
                                obj.entry("project_id").or_insert_with(|| serde_json::Value::String(pid.clone()));
                                obj.entry("agent_instance_id").or_insert_with(|| serde_json::Value::String(aiid.clone()));
                            }
                            let _ = bc.send(value);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    }
                }
            }
        }
    });
}

async fn active_instances_for_project_harness(
    state: &AppState,
    project_id: ProjectId,
) -> Vec<AgentInstanceId> {
    let reg = state.harness_sessions.lock().await;
    reg.iter()
        .filter(|(_, s)| s.project_id == project_id)
        .map(|(aiid, _)| *aiid)
        .collect()
}

pub(crate) async fn start_loop(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    Query(params): Query<LoopQueryParams>,
) -> ApiResult<(StatusCode, Json<LoopStatusResponse>)> {
    super::billing::require_credits(&state).await?;

    let agent_instance_id = params
        .agent_instance_id
        .unwrap_or_else(AgentInstanceId::new);

    let harness_mode = if let Some(aiid) = params.agent_instance_id {
        state
            .agent_instance_service
            .get_instance(&project_id, &aiid)
            .await
            .map(|inst| inst.harness_mode())
            .unwrap_or(HarnessMode::Local)
    } else {
        HarnessMode::Local
    };
    let harness = state.harness_for(harness_mode);
    let session = harness
        .open_session(SessionConfig {
            agent_id: Some(agent_instance_id.to_string()),
            ..Default::default()
        })
        .await
        .map_err(|e| ApiError::internal(format!("opening dev loop session: {e}")))?;

    let session_id = session.session_id.clone();
    let commands_tx = session.commands_tx.clone();

    info!(
        %project_id,
        %agent_instance_id,
        %session_id,
        "Dev loop harness session opened"
    );

    commands_tx
        .send(HarnessInbound::UserMessage(UserMessage {
            content: format!("Start dev loop for project {project_id}"),
        }))
        .map_err(|e| ApiError::internal(format!("sending dev loop start: {e}")))?;

    emit_domain_event(
        &state.event_broadcast,
        "loop_started",
        project_id,
        agent_instance_id,
        serde_json::json!({}),
    );
    forward_harness_events(
        &session.events_tx,
        &session.raw_events_tx,
        state.event_broadcast.clone(),
        project_id,
        agent_instance_id,
    );
    {
        let mut reg = state.harness_sessions.lock().await;
        reg.insert(agent_instance_id, ActiveHarnessSession {
            session_id,
            commands_tx,
            project_id,
        });
    }
    let active_agent_instances = active_instances_for_project_harness(&state, project_id).await;

    Ok((
        StatusCode::CREATED,
        Json(LoopStatusResponse {
            running: true,
            paused: false,
            project_id: Some(project_id),
            agent_instance_id: Some(agent_instance_id),
            active_agent_instances: Some(active_agent_instances),
        }),
    ))
}

pub(crate) async fn pause_loop(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    Query(params): Query<LoopQueryParams>,
) -> ApiResult<Json<LoopStatusResponse>> {
    let reg = state.harness_sessions.lock().await;

    let targets: Vec<AgentInstanceId> = reg
        .iter()
        .filter(|(_, s)| s.project_id == project_id)
        .filter(|(aiid, _)| params.agent_instance_id.is_none_or(|t| **aiid == t))
        .map(|(aiid, _)| *aiid)
        .collect();
    drop(reg);

    if targets.is_empty() {
        return Err(ApiError::bad_request("no matching dev loop is running"));
    }

    for aiid in &targets {
        let reg = state.harness_sessions.lock().await;
        if let Some(session) = reg.get(aiid) {
            let _ = session.commands_tx.send(HarnessInbound::Cancel);
        }
        emit_domain_event(
            &state.event_broadcast,
            "loop_paused",
            project_id,
            *aiid,
            serde_json::json!({}),
        );
    }

    let active_agent_instances = active_instances_for_project_harness(&state, project_id).await;

    Ok(Json(LoopStatusResponse {
        running: true,
        paused: true,
        project_id: Some(project_id),
        agent_instance_id: params.agent_instance_id,
        active_agent_instances: Some(active_agent_instances),
    }))
}

pub(crate) async fn stop_loop(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    Query(params): Query<LoopQueryParams>,
) -> ApiResult<Json<LoopStatusResponse>> {
    let mut reg = state.harness_sessions.lock().await;

    let targets: Vec<AgentInstanceId> = reg
        .iter()
        .filter(|(_, s)| s.project_id == project_id)
        .filter(|(aiid, _)| params.agent_instance_id.is_none_or(|t| **aiid == t))
        .map(|(aiid, _)| *aiid)
        .collect();

    if targets.is_empty() {
        return Err(ApiError::bad_request("no matching dev loop is running"));
    }

    for aiid in &targets {
        if let Some(session) = reg.remove(aiid) {
            let _ = session.commands_tx.send(HarnessInbound::Cancel);
        }
        emit_domain_event(
            &state.event_broadcast,
            "loop_stopped",
            project_id,
            *aiid,
            serde_json::json!({}),
        );
    }

    let remaining: Vec<AgentInstanceId> = reg
        .iter()
        .filter(|(_, s)| s.project_id == project_id)
        .map(|(aiid, _)| *aiid)
        .collect();
    drop(reg);

    Ok(Json(LoopStatusResponse {
        running: !remaining.is_empty(),
        paused: false,
        project_id: Some(project_id),
        agent_instance_id: params.agent_instance_id,
        active_agent_instances: Some(remaining),
    }))
}

pub(crate) async fn get_loop_status(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<LoopStatusResponse>> {
    let mut reg = state.harness_sessions.lock().await;

    let mut to_remove = Vec::new();
    for (aiid, session) in reg.iter() {
        if session.project_id == project_id && session.commands_tx.is_closed() {
            to_remove.push(*aiid);
        }
    }
    for aiid in &to_remove {
        reg.remove(aiid);
    }

    let active: Vec<AgentInstanceId> = reg
        .iter()
        .filter(|(_, s)| s.project_id == project_id)
        .map(|(aiid, _)| *aiid)
        .collect();
    drop(reg);

    Ok(Json(LoopStatusResponse {
        running: !active.is_empty(),
        paused: false,
        project_id: Some(project_id),
        agent_instance_id: None,
        active_agent_instances: Some(active),
    }))
}

pub(crate) async fn run_single_task(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(ProjectId, TaskId)>,
    Query(params): Query<LoopQueryParams>,
) -> ApiResult<StatusCode> {
    super::billing::require_credits(&state).await?;

    let harness_mode = if let Some(aiid) = params.agent_instance_id {
        state
            .agent_instance_service
            .get_instance(&project_id, &aiid)
            .await
            .map(|inst| inst.harness_mode())
            .unwrap_or(HarnessMode::Local)
    } else {
        HarnessMode::Local
    };
    let harness = state.harness_for(harness_mode);
    let session = harness
        .open_session(SessionConfig {
            agent_id: params.agent_instance_id.map(|id| id.to_string()),
            ..Default::default()
        })
        .await
        .map_err(|e| ApiError::internal(format!("opening task runner session: {e}")))?;

    let agent_instance_id = params
        .agent_instance_id
        .unwrap_or_else(AgentInstanceId::new);

    session
        .commands_tx
        .send(HarnessInbound::UserMessage(UserMessage {
            content: format!("Execute task {task_id} in project {project_id}"),
        }))
        .map_err(|e| ApiError::internal(format!("sending task run command: {e}")))?;

    forward_harness_events(
        &session.events_tx,
        &session.raw_events_tx,
        state.event_broadcast.clone(),
        project_id,
        agent_instance_id,
    );

    Ok(StatusCode::ACCEPTED)
}
