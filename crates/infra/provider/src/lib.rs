#![warn(missing_docs)]
//! Provider-agnostic LLM types and traits.
//!
//! This crate defines the common interface for language model providers,
//! allowing the rest of the system to be decoupled from any specific
//! provider implementation (e.g. Claude, OpenAI).

mod error;
mod request;
mod streaming;
mod tokens;
mod traits;
mod types;

pub use error::ProviderError;
pub use request::{ModelRequest, ModelResponse, StopReason, ThinkingConfig, ToolChoice, Usage};
pub use streaming::{StreamAccumulator, StreamContentType, StreamEvent};
pub use tokens::{estimate_message_tokens, estimate_tokens};
pub use traits::{ModelProvider, StreamEventStream};
pub use types::{
    CacheControl, ContentBlock, ImageSource, Message, MessageContent, Role, ToolCall,
    ToolDefinition,
};
