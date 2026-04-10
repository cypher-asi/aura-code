use tracing::warn;

use aura_os_core::ZeroAuthSession;

use crate::error::{map_network_error, ApiError, ApiResult};
use crate::state::AppState;

/// Map a role string to a numeric level for comparison.
/// Matches the hierarchy in aura-network: owner (3) > admin (2) > member (1).
pub(crate) fn role_level(role: &str) -> u8 {
    match role {
        "owner" => 3,
        "admin" => 2,
        "member" => 1,
        _ => 0,
    }
}

/// Resolve the user's network-facing ID from the session.
/// Prefers `network_user_id` (set after sync to aura-network) and falls back
/// to `user_id` (zOS ID) if the user has not been synced yet.
fn resolve_user_id(session: &ZeroAuthSession) -> String {
    session
        .network_user_id
        .map(|id| id.to_string())
        .unwrap_or_else(|| session.user_id.clone())
}

/// Check that the authenticated user has at least `min_role` in the given org.
/// Returns the user's actual role string on success, or 403 Forbidden on failure.
pub(crate) async fn require_org_role(
    state: &AppState,
    org_id: &str,
    jwt: &str,
    session: &ZeroAuthSession,
    min_role: &str,
) -> ApiResult<String> {
    let client = state.require_network_client()?;
    let members = client
        .list_org_members(org_id, jwt)
        .await
        .map_err(map_network_error)?;

    let user_id = resolve_user_id(session);
    let member = members
        .iter()
        .find(|m| m.user_id == user_id)
        .ok_or_else(|| {
            warn!(
                user_id = %user_id,
                org_id = %org_id,
                "user not found in org members during role check"
            );
            ApiError::forbidden("not a member of this organization")
        })?;

    if role_level(&member.role) < role_level(min_role) {
        return Err(ApiError::forbidden(format!(
            "requires at least '{}' role",
            min_role
        )));
    }

    Ok(member.role.clone())
}

/// Check that the user is either the process creator or has admin+ role in the org.
/// Used for process update/delete and node/connection mutations.
pub(crate) async fn require_process_edit_permission(
    state: &AppState,
    org_id: &str,
    created_by: &str,
    jwt: &str,
    session: &ZeroAuthSession,
) -> ApiResult<()> {
    let user_id = resolve_user_id(session);

    // Creator can always edit their own process
    if created_by == user_id {
        return Ok(());
    }

    // Otherwise, require admin+ role
    require_org_role(state, org_id, jwt, session, "admin").await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_level_hierarchy() {
        assert!(role_level("owner") > role_level("admin"));
        assert!(role_level("admin") > role_level("member"));
        assert!(role_level("member") > role_level("unknown"));
        assert_eq!(role_level("owner"), 3);
        assert_eq!(role_level("admin"), 2);
        assert_eq!(role_level("member"), 1);
        assert_eq!(role_level(""), 0);
    }
}
