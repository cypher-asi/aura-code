mod error;
pub use error::OrgError;

use std::sync::Arc;

use chrono::Utc;

use aura_core::*;
use aura_store::RocksStore;

pub struct OrgService {
    store: Arc<RocksStore>,
}

impl OrgService {
    pub fn new(store: Arc<RocksStore>) -> Self {
        Self { store }
    }

    pub fn get_org(&self, org_id: &OrgId) -> Result<Org, OrgError> {
        self.store.get_org(org_id).map_err(|e| match e {
            aura_store::StoreError::NotFound(_) => OrgError::NotFound(*org_id),
            other => OrgError::Store(other),
        })
    }

    pub fn set_billing(&self, org_id: &OrgId, actor_user_id: &str, billing: OrgBilling) -> Result<Org, OrgError> {
        self.require_admin_or_owner(org_id, actor_user_id)?;
        let mut org = self.get_org(org_id)?;
        org.billing = Some(billing);
        org.updated_at = Utc::now();
        self.store.put_org(&org)?;
        Ok(org)
    }

    pub fn get_billing(&self, org_id: &OrgId) -> Result<Option<OrgBilling>, OrgError> {
        let org = self.get_org(org_id)?;
        Ok(org.billing)
    }

    pub fn set_github(&self, org_id: &OrgId, actor_user_id: &str, github_org: &str) -> Result<Org, OrgError> {
        self.require_admin_or_owner(org_id, actor_user_id)?;
        let mut org = self.get_org(org_id)?;
        org.github = Some(OrgGithub { github_org: github_org.to_string(), connected_by: actor_user_id.to_string(), connected_at: Utc::now() });
        org.updated_at = Utc::now();
        self.store.put_org(&org)?;
        Ok(org)
    }

    pub fn remove_github(&self, org_id: &OrgId, actor_user_id: &str) -> Result<Org, OrgError> {
        self.require_admin_or_owner(org_id, actor_user_id)?;
        let mut org = self.get_org(org_id)?;
        org.github = None;
        org.updated_at = Utc::now();
        self.store.put_org(&org)?;
        Ok(org)
    }

    pub fn get_github(&self, org_id: &OrgId) -> Result<Option<OrgGithub>, OrgError> {
        let org = self.get_org(org_id)?;
        Ok(org.github)
    }

    fn get_member(&self, org_id: &OrgId, user_id: &str) -> Result<OrgMember, OrgError> {
        self.store.get_org_member(org_id, user_id).map_err(|e| match e {
            aura_store::StoreError::NotFound(_) => OrgError::Forbidden(format!("user {user_id} is not a member of org {org_id}")),
            other => OrgError::Store(other),
        })
    }

    pub fn require_admin_or_owner_pub(&self, org_id: &OrgId, user_id: &str) -> Result<OrgMember, OrgError> {
        self.require_admin_or_owner(org_id, user_id)
    }

    fn require_admin_or_owner(&self, org_id: &OrgId, user_id: &str) -> Result<OrgMember, OrgError> {
        let member = self.get_member(org_id, user_id)?;
        if member.role != OrgRole::Owner && member.role != OrgRole::Admin {
            return Err(OrgError::Forbidden("requires Admin or Owner role".into()));
        }
        Ok(member)
    }
}
