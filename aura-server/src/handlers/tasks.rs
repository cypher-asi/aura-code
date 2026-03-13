use axum::extract::{Path, State};
use axum::Json;

use aura_core::{ProjectId, SpecId, Task, TaskId};
use aura_services::task::ProjectProgress;

use crate::dto::TransitionTaskRequest;
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

pub async fn list_tasks(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Vec<Task>>> {
    let tasks = state
        .store
        .list_tasks_by_project(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(tasks))
}

pub async fn list_tasks_by_spec(
    State(state): State<AppState>,
    Path((project_id, spec_id)): Path<(ProjectId, SpecId)>,
) -> ApiResult<Json<Vec<Task>>> {
    let tasks = state
        .store
        .list_tasks_by_spec(&project_id, &spec_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(tasks))
}

pub async fn extract_tasks(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Vec<Task>>> {
    let tasks = state
        .task_extraction_service
        .extract_all_tasks(&project_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(tasks))
}

pub async fn transition_task(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(ProjectId, TaskId)>,
    Json(req): Json<TransitionTaskRequest>,
) -> ApiResult<Json<Task>> {
    let all_tasks = state
        .store
        .list_tasks_by_project(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    let task = all_tasks
        .iter()
        .find(|t| t.task_id == task_id)
        .ok_or_else(|| ApiError::not_found("task not found"))?;

    let updated = state
        .task_service
        .transition_task(&project_id, &task.spec_id, &task_id, req.new_status)
        .map_err(|e| match &e {
            aura_services::TaskError::NotFound => ApiError::not_found("task not found"),
            aura_services::TaskError::IllegalTransition { .. } => {
                ApiError::bad_request(e.to_string())
            }
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(updated))
}

pub async fn retry_task(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(ProjectId, TaskId)>,
) -> ApiResult<Json<Task>> {
    let all_tasks = state
        .store
        .list_tasks_by_project(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    let task = all_tasks
        .iter()
        .find(|t| t.task_id == task_id)
        .ok_or_else(|| ApiError::not_found("task not found"))?;

    let updated = state
        .task_service
        .retry_task(&project_id, &task.spec_id, &task_id)
        .map_err(|e| match &e {
            aura_services::TaskError::NotFound => ApiError::not_found("task not found"),
            aura_services::TaskError::IllegalTransition { .. } => {
                ApiError::bad_request(e.to_string())
            }
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(updated))
}

pub async fn get_progress(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<ProjectProgress>> {
    let progress = state
        .task_service
        .get_project_progress(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(progress))
}
