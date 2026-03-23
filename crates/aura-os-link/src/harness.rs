use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::harness_protocol::{HarnessInbound, HarnessOutbound, WorkspaceConfig};

pub struct SessionConfig {
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
    pub max_turns: Option<u32>,
    pub workspace: Option<WorkspaceConfig>,
    pub agent_id: Option<String>,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            system_prompt: None,
            model: None,
            max_tokens: None,
            max_turns: None,
            workspace: None,
            agent_id: None,
        }
    }
}

pub struct HarnessSession {
    pub session_id: String,
    pub events_rx: mpsc::UnboundedReceiver<HarnessOutbound>,
    pub commands_tx: mpsc::UnboundedSender<HarnessInbound>,
}

#[async_trait]
pub trait HarnessLink: Send + Sync {
    async fn open_session(&self, config: SessionConfig) -> anyhow::Result<HarnessSession>;
    async fn close_session(&self, session_id: &str) -> anyhow::Result<()>;
}
