use std::sync::Arc;

use aura_core::*;

use crate::error::StoreResult;
use crate::store::RocksStore;

impl RocksStore {
    fn cf_follows(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("follows")
    }

    pub fn put_follow(&self, follow: &Follow) -> StoreResult<()> {
        let key = format!("{}:{}", follow.follower_profile_id, follow.target_profile_id);
        let value = serde_json::to_vec(follow)?;
        self.db.put_cf(&self.cf_follows(), key.as_bytes(), &value)?;
        Ok(())
    }

    pub fn delete_follow(
        &self,
        follower_profile_id: &ProfileId,
        target_profile_id: &ProfileId,
    ) -> StoreResult<()> {
        let key = format!("{follower_profile_id}:{target_profile_id}");
        self.db.delete_cf(&self.cf_follows(), key.as_bytes())?;
        Ok(())
    }

    pub fn list_follows_by_profile(&self, follower_profile_id: &ProfileId) -> StoreResult<Vec<Follow>> {
        let prefix = format!("{follower_profile_id}:");
        let mut opts = rocksdb::ReadOptions::default();
        opts.set_total_order_seek(true);
        let iter = self.db.iterator_cf_opt(
            &self.cf_follows(),
            opts,
            rocksdb::IteratorMode::From(prefix.as_bytes(), rocksdb::Direction::Forward),
        );
        let mut results = Vec::new();
        for item in iter {
            let (key, value) = item?;
            if !key.starts_with(prefix.as_bytes()) {
                break;
            }
            match serde_json::from_slice(&value) {
                Ok(v) => results.push(v),
                Err(e) => {
                    let key_str = String::from_utf8_lossy(&key);
                    tracing::warn!("Skipping unreadable follow entry {key_str}: {e}");
                }
            }
        }
        Ok(results)
    }

    pub fn is_following(
        &self,
        follower_profile_id: &ProfileId,
        target_profile_id: &ProfileId,
    ) -> StoreResult<bool> {
        let key = format!("{follower_profile_id}:{target_profile_id}");
        Ok(self
            .db
            .get_cf(&self.cf_follows(), key.as_bytes())?
            .is_some())
    }
}
