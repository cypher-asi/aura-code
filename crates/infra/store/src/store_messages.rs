// DEPRECATED: Messages are migrated to aura-storage (Phase 7).
// These methods are kept as local-write fallback for the chat service
// until Phase 9 removes them entirely.

use std::sync::Arc;

use aura_core::*;

use crate::error::StoreResult;
use crate::store::RocksStore;

impl RocksStore {
    fn cf_messages(&self) -> Arc<rocksdb::BoundColumnFamily<'_>> {
        self.cf_handle("messages")
    }

    #[deprecated(note = "use StorageClient.create_message (Phase 7 migration)")]
    pub fn put_message(&self, message: &Message) -> StoreResult<()> {
        let key = format!(
            "{}:{}:{}",
            message.project_id, message.agent_instance_id, message.message_id
        );
        let value = serde_json::to_vec(message)?;
        self.db
            .put_cf(&self.cf_messages(), key.as_bytes(), &value)?;
        Ok(())
    }

    #[deprecated(note = "use StorageClient.list_messages (Phase 7 migration)")]
    pub fn list_messages(
        &self,
        project_id: &ProjectId,
        agent_instance_id: &AgentInstanceId,
    ) -> StoreResult<Vec<Message>> {
        let prefix = format!("{project_id}:{agent_instance_id}:");
        self.scan_cf::<Message>(&self.cf_messages(), Some(&prefix))
    }

    #[deprecated(note = "use StorageClient.delete_project_agent (Phase 7 migration)")]
    pub fn delete_messages_by_agent_instance(
        &self,
        project_id: &ProjectId,
        agent_instance_id: &AgentInstanceId,
    ) -> StoreResult<()> {
        let prefix = format!("{project_id}:{agent_instance_id}:");
        let cf = self.cf_messages();
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

    #[deprecated(note = "agent-level messages stay local until Phase 9")]
    pub fn put_agent_message(&self, agent_id: &AgentId, message: &Message) -> StoreResult<()> {
        let key = format!("agent:{}:{}", agent_id, message.message_id);
        let value = serde_json::to_vec(message)?;
        self.db
            .put_cf(&self.cf_messages(), key.as_bytes(), &value)?;
        Ok(())
    }

    #[deprecated(note = "agent-level messages stay local until Phase 9")]
    pub fn list_agent_messages(&self, agent_id: &AgentId) -> StoreResult<Vec<Message>> {
        let prefix = format!("agent:{agent_id}:");
        self.scan_cf::<Message>(&self.cf_messages(), Some(&prefix))
    }

    #[deprecated(note = "use StorageClient message count via sessions (Phase 7 migration)")]
    pub fn count_messages_by_project(&self, project_id: &ProjectId) -> StoreResult<usize> {
        let prefix = format!("{project_id}:");
        let cf = self.cf_messages();
        let iter = self.db.prefix_iterator_cf(&cf, prefix.as_bytes());
        let mut count = 0;
        for item in iter {
            let (key, _) = item?;
            if !key.starts_with(prefix.as_bytes()) {
                break;
            }
            count += 1;
        }
        Ok(count)
    }
}
