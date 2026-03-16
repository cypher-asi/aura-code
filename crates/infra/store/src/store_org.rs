use std::sync::Arc;

use rocksdb::WriteBatch;

use aura_core::*;

use crate::error::{StoreError, StoreResult};
use crate::store::RocksStore;

impl RocksStore {
    fn cf_orgs(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("orgs")
    }

    fn cf_org_members(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("org_members")
    }

    fn cf_user_orgs(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("user_orgs")
    }

    fn cf_org_invites(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("org_invites")
    }

    // -- Org CRUD --

    pub fn put_org(&self, org: &Org) -> StoreResult<()> {
        let key = org.org_id.to_string();
        let value = serde_json::to_vec(org)?;
        self.db.put_cf(&self.cf_orgs(), key.as_bytes(), &value)?;
        Ok(())
    }

    pub fn get_org(&self, org_id: &OrgId) -> StoreResult<Org> {
        let key = org_id.to_string();
        let bytes = self
            .db
            .get_cf(&self.cf_orgs(), key.as_bytes())?
            .ok_or_else(|| StoreError::NotFound(format!("org:{org_id}")))?;
        Ok(serde_json::from_slice(&bytes)?)
    }

    pub fn delete_org(&self, org_id: &OrgId) -> StoreResult<()> {
        let key = org_id.to_string();
        self.db.delete_cf(&self.cf_orgs(), key.as_bytes())?;
        Ok(())
    }

    pub fn list_orgs(&self) -> StoreResult<Vec<Org>> {
        self.scan_cf::<Org>(&self.cf_orgs(), None)
    }

    // -- OrgMember CRUD (dual-write to org_members + user_orgs) --

    pub fn put_org_member(&self, member: &OrgMember) -> StoreResult<()> {
        let value = serde_json::to_vec(member)?;
        let om_key = format!("{}:{}", member.org_id, member.user_id);
        let uo_key = format!("{}:{}", member.user_id, member.org_id);

        let mut batch = WriteBatch::default();
        batch.put_cf(&self.cf_org_members(), om_key.as_bytes(), &value);
        batch.put_cf(&self.cf_user_orgs(), uo_key.as_bytes(), &value);
        self.db.write(batch)?;
        Ok(())
    }

    pub fn get_org_member(&self, org_id: &OrgId, user_id: &str) -> StoreResult<OrgMember> {
        let key = format!("{org_id}:{user_id}");
        let bytes = self
            .db
            .get_cf(&self.cf_org_members(), key.as_bytes())?
            .ok_or_else(|| StoreError::NotFound(format!("org_member:{key}")))?;
        Ok(serde_json::from_slice(&bytes)?)
    }

    pub fn delete_org_member(&self, org_id: &OrgId, user_id: &str) -> StoreResult<()> {
        let om_key = format!("{org_id}:{user_id}");
        let uo_key = format!("{user_id}:{org_id}");

        let mut batch = WriteBatch::default();
        batch.delete_cf(&self.cf_org_members(), om_key.as_bytes());
        batch.delete_cf(&self.cf_user_orgs(), uo_key.as_bytes());
        self.db.write(batch)?;
        Ok(())
    }

    pub fn list_org_members(&self, org_id: &OrgId) -> StoreResult<Vec<OrgMember>> {
        let prefix = format!("{org_id}:");
        self.scan_cf::<OrgMember>(&self.cf_org_members(), Some(&prefix))
    }

    pub fn list_user_orgs(&self, user_id: &str) -> StoreResult<Vec<OrgMember>> {
        let prefix = format!("{user_id}:");
        self.scan_cf::<OrgMember>(&self.cf_user_orgs(), Some(&prefix))
    }

    // -- OrgInvite CRUD --

    pub fn put_org_invite(&self, invite: &OrgInvite) -> StoreResult<()> {
        let key = format!("{}:{}", invite.org_id, invite.invite_id);
        let value = serde_json::to_vec(invite)?;
        self.db
            .put_cf(&self.cf_org_invites(), key.as_bytes(), &value)?;
        Ok(())
    }

    pub fn get_org_invite(
        &self,
        org_id: &OrgId,
        invite_id: &InviteId,
    ) -> StoreResult<OrgInvite> {
        let key = format!("{org_id}:{invite_id}");
        let bytes = self
            .db
            .get_cf(&self.cf_org_invites(), key.as_bytes())?
            .ok_or_else(|| StoreError::NotFound(format!("org_invite:{key}")))?;
        Ok(serde_json::from_slice(&bytes)?)
    }

    pub fn list_org_invites(&self, org_id: &OrgId) -> StoreResult<Vec<OrgInvite>> {
        let prefix = format!("{org_id}:");
        self.scan_cf::<OrgInvite>(&self.cf_org_invites(), Some(&prefix))
    }

    pub fn get_org_invite_by_token(&self, token: &str) -> StoreResult<OrgInvite> {
        let invites = self.scan_cf::<OrgInvite>(&self.cf_org_invites(), None)?;
        invites
            .into_iter()
            .find(|inv| inv.token == token)
            .ok_or_else(|| StoreError::NotFound(format!("org_invite:token:{token}")))
    }
}
