use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use aura_os_core::ProjectId;
use aura_os_storage::ProjectStats;

use crate::error::{map_storage_error, ApiResult};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub(crate) struct ProjectStatsResponse {
    pub total_tasks: u64,
    pub tasks_pending: u64,
    pub tasks_ready: u64,
    pub tasks_in_progress: u64,
    pub tasks_blocked: u64,
    pub tasks_done: u64,
    pub tasks_failed: u64,
    pub completion_percentage: f64,
    pub total_tokens: u64,
    pub total_events: u64,
    pub total_agents: u64,
    pub total_sessions: u64,
    pub total_time_seconds: f64,
    pub lines_changed: u64,
    pub total_specs: u64,
    pub contributors: Vec<String>,
}

impl From<ProjectStats> for ProjectStatsResponse {
    fn from(s: ProjectStats) -> Self {
        Self {
            total_tasks: s.total_tasks,
            tasks_pending: s.tasks_pending,
            tasks_ready: s.tasks_ready,
            tasks_in_progress: s.tasks_in_progress,
            tasks_blocked: s.tasks_blocked,
            tasks_done: s.tasks_done,
            tasks_failed: s.tasks_failed,
            completion_percentage: s.completion_percentage,
            total_tokens: s.total_tokens,
            total_events: s.total_events,
            total_agents: s.total_agents,
            total_sessions: s.total_sessions,
            total_time_seconds: s.total_time_seconds,
            lines_changed: s.lines_changed,
            total_specs: s.total_specs,
            contributors: s.contributors,
        }
    }
}

pub(crate) async fn get_project_stats(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<ProjectStatsResponse>> {
    let client = state.require_storage_client()?;
    let jwt = state.get_jwt()?;
    let stats = client
        .get_project_stats(&project_id.to_string(), &jwt)
        .await
        .map_err(map_storage_error)?;
    Ok(Json(ProjectStatsResponse::from(stats)))
}
