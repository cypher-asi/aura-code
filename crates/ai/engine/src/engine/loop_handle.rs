use aura_core::*;
use tokio::sync::watch;

use super::types::*;
use crate::error::EngineError;

pub struct LoopHandle {
    pub project_id: ProjectId,
    pub agent_instance_id: AgentInstanceId,
    pub(crate) stop_tx: watch::Sender<LoopCommand>,
    pub(crate) join_handle: tokio::task::JoinHandle<Result<LoopOutcome, EngineError>>,
}

impl LoopHandle {
    pub fn pause(&self) {
        let _ = self.stop_tx.send(LoopCommand::Pause);
    }

    pub fn stop(&self) {
        let _ = self.stop_tx.send(LoopCommand::Stop);
    }

    pub fn is_finished(&self) -> bool {
        self.join_handle.is_finished()
    }

    pub async fn wait(self) -> Result<LoopOutcome, EngineError> {
        self.join_handle
            .await
            .map_err(|e| EngineError::Join(e.to_string()))?
    }
}
