#![warn(missing_docs)]
//! Agentic execution link — [`SwarmClient`] HTTP client for the
//! automaton management API.
//!
//! ## Legacy runtime surface
//!
//! The [`AgentRuntime`] trait, [`LinkRuntime`], [`ToolExecutor`],
//! [`TurnRequest`] / [`TurnResult`], and [`RuntimeEvent`] types are kept
//! temporarily for integration tests. No app crate should depend on them.
//! They will be deleted once those tests are migrated to the swarm path.

// ── Legacy modules (do not depend on from app crates) ────────────────
mod error;
mod events;
mod executor;
mod link_runtime;
mod runtime;
mod turn_types;
mod types;

pub use error::RuntimeError;
pub use events::RuntimeEvent;
pub use executor::{AutoBuildResult, BuildBaseline, ToolCallResult, ToolExecutor};
pub use link_runtime::LinkRuntime;
pub use runtime::AgentRuntime;
pub use turn_types::{TotalUsage, TurnConfig, TurnRequest, TurnResult};
pub use types::{
    tool_result_as_str, tool_result_text_mut, CacheControl, ContentBlock, ImageSource, Message,
    MessageContent, Role, ThinkingConfig, ToolCall, ToolDefinition, ToolResultContent,
};

// ── Swarm client ─────────────────────────────────────────────────────
mod swarm_client;
mod swarm_types;

pub use swarm_client::SwarmClient;
pub use swarm_types::{AutomatonEvent, AutomatonInfo, AutomatonStatus, InstallRequest, InstallResponse};

#[cfg(test)]
mod tests;
