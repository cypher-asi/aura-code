use axum::extract::{Query, State};
use serde::Deserialize;

use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListOrbitReposQuery {
    pub q: Option<String>,
}

/// GET /api/orbit/repos?q=...
/// Returns repos the current user can use (JWT auth). Requires ORBIT_BASE_URL to be set.
/// Each repo includes a resolved clone_url for Git operations.
pub async fn list_orbit_repos(
    State(state): State<AppState>,
    Query(query): Query<ListOrbitReposQuery>,
) -> ApiResult<axum::Json<Vec<aura_orbit::OrbitRepo>>> {
    let base_url = state
        .orbit_base_url
        .as_deref()
        .ok_or_else(|| ApiError::service_unavailable("Orbit is not configured (ORBIT_BASE_URL)"))?;
    let jwt = state.get_jwt()?;

    let repos = state
        .orbit_client
        .list_repos(base_url, &jwt, query.q.as_deref())
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;

    let repos_with_url: Vec<aura_orbit::OrbitRepo> = repos
        .into_iter()
        .map(|r| {
            let clone_url = Some(r.clone_url_or(base_url));
            aura_orbit::OrbitRepo {
                id: r.id,
                name: r.name,
                owner: r.owner,
                full_name: r.full_name,
                clone_url,
                git_url: r.git_url,
            }
        })
        .collect();

    Ok(axum::Json(repos_with_url))
}
