//! The core agent runtime trait.

use async_trait::async_trait;

use crate::error::RuntimeError;
use crate::turn_types::{TurnRequest, TurnResult};

/// A pluggable agent execution backend.
///
/// Implementations handle the full agentic loop: LLM calls, tool execution,
/// result injection, and iteration until the model returns `EndTurn` or a
/// stop condition is reached.
///
/// The current in-process implementation (`InternalRuntime` in `aura-chat`)
/// wraps the existing tool loop. Future adapters will wrap `aura-runtime`'s
/// `TurnProcessor` (local) or its WebSocket protocol (remote).
#[async_trait]
pub trait AgentRuntime: Send + Sync {
    /// Execute a complete agent turn.
    async fn execute_turn(&self, request: TurnRequest) -> Result<TurnResult, RuntimeError>;
}
