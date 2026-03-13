use axum::extract::{Path, State};
use axum::Json;

use aura_core::{Agent, AgentId, ProjectId, Session};

use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

pub async fn list_agents(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Vec<Agent>>> {
    let agents = state
        .agent_service
        .list_agents(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(agents))
}

pub async fn get_agent(
    State(state): State<AppState>,
    Path((project_id, agent_id)): Path<(ProjectId, AgentId)>,
) -> ApiResult<Json<Agent>> {
    let agent = state
        .agent_service
        .get_agent(&project_id, &agent_id)
        .map_err(|e| match &e {
            aura_services::AgentError::NotFound => ApiError::not_found("agent not found"),
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(agent))
}

pub async fn list_sessions(
    State(state): State<AppState>,
    Path((project_id, agent_id)): Path<(ProjectId, AgentId)>,
) -> ApiResult<Json<Vec<Session>>> {
    let sessions = state
        .session_service
        .list_sessions(&project_id, &agent_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(sessions))
}
