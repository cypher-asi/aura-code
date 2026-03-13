use axum::extract::{Path, State};
use axum::Json;

use aura_core::{ProjectId, Spec, SpecId};

use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

pub async fn list_specs(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Vec<Spec>>> {
    let specs = state
        .spec_gen_service
        .list_specs(&project_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(specs))
}

pub async fn get_spec(
    State(state): State<AppState>,
    Path((project_id, spec_id)): Path<(ProjectId, SpecId)>,
) -> ApiResult<Json<Spec>> {
    let spec = state
        .spec_gen_service
        .get_spec(&project_id, &spec_id)
        .map_err(|e| match e {
            aura_services::SpecGenError::Store(aura_store::StoreError::NotFound(_)) => {
                ApiError::not_found("spec not found")
            }
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(spec))
}

pub async fn generate_specs(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> ApiResult<Json<Vec<Spec>>> {
    let specs = state
        .spec_gen_service
        .generate_specs(&project_id)
        .await
        .map_err(|e| match &e {
            aura_services::SpecGenError::ProjectNotFound(_) => {
                ApiError::not_found("project not found")
            }
            aura_services::SpecGenError::RequirementsFileNotFound(p) => {
                ApiError::bad_request(format!("requirements file not found: {p}"))
            }
            aura_services::SpecGenError::Settings(_) => {
                ApiError::bad_request("API key not configured")
            }
            _ => ApiError::internal(e.to_string()),
        })?;
    Ok(Json(specs))
}
