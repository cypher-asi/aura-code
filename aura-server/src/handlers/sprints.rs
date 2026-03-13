use axum::extract::{Path, State};
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use tracing::info;

use aura_core::{ProjectId, Sprint, SprintId};

use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateSprintRequest {
    pub title: String,
    #[serde(default)]
    pub prompt: String,
}

#[derive(Deserialize)]
pub struct UpdateSprintRequest {
    pub title: Option<String>,
    pub prompt: Option<String>,
}

#[derive(Deserialize)]
pub struct ReorderSprintsRequest {
    pub sprint_ids: Vec<SprintId>,
}

pub async fn list_sprints(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Vec<Sprint>>> {
    let mut sprints = state
        .store
        .list_sprints_by_project(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    sprints.sort_by_key(|s| s.order_index);
    Ok(Json(sprints))
}

pub async fn create_sprint(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    Json(body): Json<CreateSprintRequest>,
) -> ApiResult<Json<Sprint>> {
    let existing = state
        .store
        .list_sprints_by_project(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    let now = Utc::now();
    let sprint = Sprint {
        sprint_id: SprintId::new(),
        project_id,
        title: body.title,
        prompt: body.prompt,
        order_index: existing.len() as u32,
        created_at: now,
        updated_at: now,
    };

    state
        .store
        .put_sprint(&sprint)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    info!(%project_id, sprint_id = %sprint.sprint_id, "Sprint created");
    Ok(Json(sprint))
}

pub async fn get_sprint(
    State(state): State<AppState>,
    Path((project_id, sprint_id)): Path<(ProjectId, SprintId)>,
) -> ApiResult<Json<Sprint>> {
    let sprint = state
        .store
        .get_sprint(&project_id, &sprint_id)
        .map_err(|e| match e {
            aura_store::StoreError::NotFound(_) => ApiError::not_found("sprint not found"),
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(sprint))
}

pub async fn update_sprint(
    State(state): State<AppState>,
    Path((project_id, sprint_id)): Path<(ProjectId, SprintId)>,
    Json(body): Json<UpdateSprintRequest>,
) -> ApiResult<Json<Sprint>> {
    let mut sprint = state
        .store
        .get_sprint(&project_id, &sprint_id)
        .map_err(|e| match e {
            aura_store::StoreError::NotFound(_) => ApiError::not_found("sprint not found"),
            _ => ApiError::internal(e.to_string()),
        })?;

    if let Some(title) = body.title {
        sprint.title = title;
    }
    if let Some(prompt) = body.prompt {
        sprint.prompt = prompt;
    }
    sprint.updated_at = Utc::now();

    state
        .store
        .put_sprint(&sprint)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    Ok(Json(sprint))
}

pub async fn delete_sprint(
    State(state): State<AppState>,
    Path((project_id, sprint_id)): Path<(ProjectId, SprintId)>,
) -> ApiResult<Json<()>> {
    state
        .store
        .delete_sprint(&project_id, &sprint_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    info!(%project_id, %sprint_id, "Sprint deleted");
    Ok(Json(()))
}

pub async fn reorder_sprints(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    Json(body): Json<ReorderSprintsRequest>,
) -> ApiResult<Json<Vec<Sprint>>> {
    let mut sprints = state
        .store
        .list_sprints_by_project(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;

    let id_to_index: std::collections::HashMap<SprintId, u32> = body
        .sprint_ids
        .iter()
        .enumerate()
        .map(|(i, id)| (*id, i as u32))
        .collect();

    for sprint in &mut sprints {
        if let Some(&new_idx) = id_to_index.get(&sprint.sprint_id) {
            sprint.order_index = new_idx;
            sprint.updated_at = Utc::now();
            state
                .store
                .put_sprint(sprint)
                .map_err(|e| ApiError::internal(e.to_string()))?;
        }
    }

    sprints.sort_by_key(|s| s.order_index);
    Ok(Json(sprints))
}
