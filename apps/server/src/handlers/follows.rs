use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;

use aura_core::*;

use crate::dto::{FollowCheckResponse, FollowRequest};
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

fn get_profile_id(state: &AppState) -> Result<ProfileId, (StatusCode, Json<ApiError>)> {
    let session_bytes = state
        .store
        .get_setting("zero_auth_session")
        .map_err(|_| ApiError::unauthorized("not authenticated"))?;
    let session: ZeroAuthSession =
        serde_json::from_slice(&session_bytes).map_err(|e| ApiError::internal(e.to_string()))?;
    session
        .profile_id
        .ok_or_else(|| ApiError::bad_request("profile not synced to aura-network yet — please re-login"))
}

pub async fn follow(
    State(state): State<AppState>,
    Json(req): Json<FollowRequest>,
) -> ApiResult<(StatusCode, Json<Follow>)> {
    let follower_profile_id = get_profile_id(&state)?;
    let target_profile_id: ProfileId = req
        .target_profile_id
        .parse()
        .map_err(|_| ApiError::bad_request("invalid target_profile_id"))?;

    let follow = Follow {
        id: ProfileId::new().to_string(),
        follower_profile_id,
        target_profile_id,
        created_at: Utc::now(),
    };
    state
        .store
        .put_follow(&follow)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok((StatusCode::CREATED, Json(follow)))
}

pub async fn unfollow(
    State(state): State<AppState>,
    Path(target_profile_id): Path<String>,
) -> ApiResult<StatusCode> {
    let follower_profile_id = get_profile_id(&state)?;
    let target: ProfileId = target_profile_id
        .parse()
        .map_err(|_| ApiError::bad_request("invalid target_profile_id"))?;
    state
        .store
        .delete_follow(&follower_profile_id, &target)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_follows(State(state): State<AppState>) -> ApiResult<Json<Vec<Follow>>> {
    let profile_id = get_profile_id(&state)?;
    let follows = state
        .store
        .list_follows_by_profile(&profile_id)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(follows))
}

pub async fn check_follow(
    State(state): State<AppState>,
    Path(target_profile_id): Path<String>,
) -> ApiResult<Json<FollowCheckResponse>> {
    let follower_profile_id = get_profile_id(&state)?;
    let target: ProfileId = target_profile_id
        .parse()
        .map_err(|_| ApiError::bad_request("invalid target_profile_id"))?;
    let following = state
        .store
        .is_following(&follower_profile_id, &target)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(FollowCheckResponse { following }))
}
