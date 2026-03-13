use std::sync::Arc;

use aura_core::*;

use crate::error::{StoreError, StoreResult};
use crate::store::RocksStore;

impl RocksStore {
    fn cf_github_integrations(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("github_integrations")
    }

    fn cf_github_repos(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("github_repos")
    }

    // -- GitHubIntegration CRUD --

    pub fn put_github_integration(&self, integration: &GitHubIntegration) -> StoreResult<()> {
        let key = format!("{}:{}", integration.org_id, integration.integration_id);
        let value = serde_json::to_vec(integration)?;
        self.db
            .put_cf(&self.cf_github_integrations(), key.as_bytes(), &value)?;
        Ok(())
    }

    pub fn get_github_integration(
        &self,
        org_id: &OrgId,
        integration_id: &GitHubIntegrationId,
    ) -> StoreResult<GitHubIntegration> {
        let key = format!("{org_id}:{integration_id}");
        let bytes = self
            .db
            .get_cf(&self.cf_github_integrations(), key.as_bytes())?
            .ok_or_else(|| StoreError::NotFound(format!("github_integration:{key}")))?;
        Ok(serde_json::from_slice(&bytes)?)
    }

    pub fn list_github_integrations(
        &self,
        org_id: &OrgId,
    ) -> StoreResult<Vec<GitHubIntegration>> {
        let prefix = format!("{org_id}:");
        self.scan_cf::<GitHubIntegration>(&self.cf_github_integrations(), Some(&prefix))
    }

    pub fn delete_github_integration(
        &self,
        org_id: &OrgId,
        integration_id: &GitHubIntegrationId,
    ) -> StoreResult<()> {
        let key = format!("{org_id}:{integration_id}");
        self.db
            .delete_cf(&self.cf_github_integrations(), key.as_bytes())?;
        Ok(())
    }

    // -- GitHubRepo CRUD --

    pub fn put_github_repo(&self, repo: &GitHubRepo) -> StoreResult<()> {
        let key = format!("{}:{}", repo.integration_id, repo.github_repo_id);
        let value = serde_json::to_vec(repo)?;
        self.db
            .put_cf(&self.cf_github_repos(), key.as_bytes(), &value)?;
        Ok(())
    }

    pub fn list_github_repos(
        &self,
        integration_id: &GitHubIntegrationId,
    ) -> StoreResult<Vec<GitHubRepo>> {
        let prefix = format!("{integration_id}:");
        self.scan_cf::<GitHubRepo>(&self.cf_github_repos(), Some(&prefix))
    }

    pub fn delete_github_repos_by_integration(
        &self,
        integration_id: &GitHubIntegrationId,
    ) -> StoreResult<()> {
        let prefix = format!("{integration_id}:");
        let cf = self.cf_github_repos();
        let iter = self.db.prefix_iterator_cf(&cf, prefix.as_bytes());
        for item in iter {
            let (key, _) = item?;
            if !key.starts_with(prefix.as_bytes()) {
                break;
            }
            self.db.delete_cf(&cf, &key)?;
        }
        Ok(())
    }

    pub fn list_all_github_repos_for_org(
        &self,
        org_id: &OrgId,
    ) -> StoreResult<Vec<GitHubRepo>> {
        let integrations = self.list_github_integrations(org_id)?;
        let mut all_repos = Vec::new();
        for integration in &integrations {
            let repos = self.list_github_repos(&integration.integration_id)?;
            all_repos.extend(repos);
        }
        Ok(all_repos)
    }
}
