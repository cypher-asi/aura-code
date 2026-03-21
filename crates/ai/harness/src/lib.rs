#![warn(missing_docs)]
//! Agentic execution harness — abstractions for running LLM agent turns.
//!
//! This crate defines the [`AgentRuntime`] trait (the seam where different
//! execution backends plug in) and supporting types like [`ToolExecutor`],
//! [`TurnRequest`], [`TurnResult`], and [`RuntimeEvent`].

mod error;
mod events;
mod executor;
mod runtime;
mod turn_types;

pub use error::RuntimeError;
pub use events::RuntimeEvent;
pub use executor::{AutoBuildResult, BuildBaseline, ToolCallResult, ToolExecutor};
pub use runtime::AgentRuntime;
pub use turn_types::{TotalUsage, TurnConfig, TurnRequest, TurnResult};
