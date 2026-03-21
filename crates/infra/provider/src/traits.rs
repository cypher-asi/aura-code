//! Provider trait definitions.

use std::pin::Pin;

use async_trait::async_trait;
use futures_util::Stream;

use crate::error::ProviderError;
use crate::request::{ModelRequest, ModelResponse};
use crate::streaming::StreamEvent;

/// A stream of [`StreamEvent`]s from a streaming completion.
pub type StreamEventStream = Pin<Box<dyn Stream<Item = StreamEvent> + Send>>;

/// A provider-agnostic interface for language model completions.
#[async_trait]
pub trait ModelProvider: Send + Sync {
    /// Returns the provider name (e.g. "claude", "openai").
    fn name(&self) -> &'static str;

    /// Perform a non-streaming completion.
    async fn complete(&self, request: ModelRequest) -> Result<ModelResponse, ProviderError>;

    /// Perform a streaming completion, returning a stream of events.
    async fn complete_streaming(
        &self,
        request: ModelRequest,
    ) -> Result<StreamEventStream, ProviderError>;
}
