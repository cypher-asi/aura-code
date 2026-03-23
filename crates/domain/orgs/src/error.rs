use aura_os_core::OrgId;
use aura_os_store::StoreError;

#[derive(Debug, thiserror::Error)]
pub enum OrgError {
    #[error("store error: {0}")]
    Store(#[from] StoreError),
    #[error("org not found: {0}")]
    NotFound(OrgId),
}
