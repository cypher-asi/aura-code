use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;

use aura_core::ApiKeyInfo;

use crate::dto::{GetSettingResponse, SetApiKeyRequest, SetSettingRequest};
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

pub async fn set_api_key(
    State(state): State<AppState>,
    Json(req): Json<SetApiKeyRequest>,
) -> ApiResult<(StatusCode, Json<ApiKeyInfo>)> {
    let info = state
        .settings_service
        .set_api_key(&req.api_key)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok((StatusCode::CREATED, Json(info)))
}

pub async fn get_api_key_info(State(state): State<AppState>) -> ApiResult<Json<ApiKeyInfo>> {
    let info = state
        .settings_service
        .get_api_key_info()
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(info))
}

pub async fn delete_api_key(State(state): State<AppState>) -> ApiResult<StatusCode> {
    state
        .settings_service
        .delete_api_key()
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_setting(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> ApiResult<Json<GetSettingResponse>> {
    let value = state
        .settings_service
        .get_setting(&key)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(GetSettingResponse { key, value }))
}

pub async fn set_setting(
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(req): Json<SetSettingRequest>,
) -> ApiResult<StatusCode> {
    state
        .settings_service
        .set_setting(&key, &req.value)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(StatusCode::OK)
}
