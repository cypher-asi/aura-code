use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;

use aura_core::{Project, ProjectId};
use aura_services::{CreateProjectInput, UpdateProjectInput};

use crate::dto::{CreateProjectRequest, UpdateProjectRequest};
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

pub async fn create_project(
    State(state): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> ApiResult<(StatusCode, Json<Project>)> {
    let input = CreateProjectInput {
        name: req.name,
        description: req.description,
        linked_folder_path: req.linked_folder_path,
        requirements_doc_path: req.requirements_doc_path,
    };
    let project = state
        .project_service
        .create_project(input)
        .map_err(|e| match &e {
            aura_services::ProjectError::InvalidInput(msg) => ApiError::bad_request(msg.clone()),
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn list_projects(State(state): State<AppState>) -> ApiResult<Json<Vec<Project>>> {
    let projects = state
        .project_service
        .list_projects()
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(projects))
}

pub async fn get_project(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Project>> {
    let project = state
        .project_service
        .get_project(&project_id)
        .map_err(|e| match &e {
            aura_services::ProjectError::NotFound(_) => ApiError::not_found("project not found"),
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(project))
}

pub async fn update_project(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    Json(req): Json<UpdateProjectRequest>,
) -> ApiResult<Json<Project>> {
    let input = UpdateProjectInput {
        name: req.name,
        description: req.description,
        linked_folder_path: req.linked_folder_path,
        requirements_doc_path: req.requirements_doc_path,
    };
    let project = state
        .project_service
        .update_project(&project_id, input)
        .map_err(|e| match &e {
            aura_services::ProjectError::NotFound(_) => ApiError::not_found("project not found"),
            aura_services::ProjectError::InvalidInput(msg) => ApiError::bad_request(msg.clone()),
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(project))
}

pub async fn delete_project(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<StatusCode> {
    state
        .project_service
        .delete_project(&project_id)
        .map_err(|e| match &e {
            aura_services::ProjectError::NotFound(_) => ApiError::not_found("project not found"),
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn archive_project(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Project>> {
    let project = state
        .project_service
        .archive_project(&project_id)
        .map_err(|e| match &e {
            aura_services::ProjectError::NotFound(_) => ApiError::not_found("project not found"),
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(project))
}
