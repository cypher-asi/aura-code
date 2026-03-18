use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};

use aura_core::*;
use aura_network::NetworkFollow;

use crate::dto::{FollowCheckResponse, FollowRequest};
use crate::error::{map_network_error, ApiError, ApiResult};
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

fn follow_from_network(net: &NetworkFollow) -> Follow {
    let follower_profile_id = net
        .follower_profile_id
        .parse::<ProfileId>()
        .unwrap_or_else(|_| ProfileId::new());
    let target_profile_id = net
        .target_profile_id
        .parse::<ProfileId>()
        .unwrap_or_else(|_| ProfileId::new());
    let created_at = net
        .created_at
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    Follow {
        id: net.id.clone(),
        follower_profile_id,
        target_profile_id,
        created_at,
    }
}

pub async fn follow(
    State(state): State<AppState>,
    Json(req): Json<FollowRequest>,
) -> ApiResult<(StatusCode, Json<Follow>)> {
    if let Some(client) = &state.network_client {
        let jwt = state.get_jwt()?;
        let net_req = aura_network::FollowRequest {
            target_profile_id: req.target_profile_id,
        };
        let net_follow = client
            .follow_profile(&jwt, &net_req)
            .await
            .map_err(map_network_error)?;
        Ok((StatusCode::CREATED, Json(follow_from_network(&net_follow))))
    } else {
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
}

pub async fn unfollow(
    State(state): State<AppState>,
    Path(target_profile_id): Path<String>,
) -> ApiResult<StatusCode> {
    if let Some(client) = &state.network_client {
        let jwt = state.get_jwt()?;
        client
            .unfollow_profile(&target_profile_id, &jwt)
            .await
            .map_err(map_network_error)?;
        Ok(StatusCode::NO_CONTENT)
    } else {
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
}

pub async fn list_follows(State(state): State<AppState>) -> ApiResult<Json<Vec<Follow>>> {
    if let Some(client) = &state.network_client {
        let jwt = state.get_jwt()?;
        let net_follows = client.list_follows(&jwt).await.map_err(map_network_error)?;
        let follows: Vec<Follow> = net_follows.iter().map(follow_from_network).collect();
        Ok(Json(follows))
    } else {
        let profile_id = get_profile_id(&state)?;
        let follows = state
            .store
            .list_follows_by_profile(&profile_id)
            .map_err(|e| ApiError::internal(e.to_string()))?;
        Ok(Json(follows))
    }
}

pub async fn check_follow(
    State(state): State<AppState>,
    Path(target_profile_id): Path<String>,
) -> ApiResult<Json<FollowCheckResponse>> {
    if let Some(client) = &state.network_client {
        let jwt = state.get_jwt()?;
        let net_follows = client.list_follows(&jwt).await.map_err(map_network_error)?;
        let following = net_follows
            .iter()
            .any(|f| f.target_profile_id == target_profile_id);
        Ok(Json(FollowCheckResponse { following }))
    } else {
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
}
