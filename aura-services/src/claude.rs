use bytes::Bytes;
use futures_core::Stream;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use tracing::{debug, error, info, warn};

use crate::error::ClaudeClientError;

const ANTHROPIC_API_VERSION: &str = "2023-06-01";
const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

#[derive(Debug, Clone)]
pub enum ClaudeStreamEvent {
    Delta(String),
    Done {
        stop_reason: String,
        input_tokens: u64,
        output_tokens: u64,
    },
    Error(String),
}

pub struct ClaudeClient {
    http: reqwest::Client,
    base_url: String,
}

#[derive(Serialize)]
struct MessagesRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct MessagesResponse {
    content: Vec<ContentBlock>,
    stop_reason: Option<String>,
}

#[derive(Deserialize)]
struct ContentBlock {
    text: Option<String>,
}

#[derive(Deserialize)]
struct StreamEventData {
    #[serde(rename = "type")]
    event_type: Option<String>,
    delta: Option<StreamDelta>,
    usage: Option<StreamUsage>,
    message: Option<StreamMessage>,
    content_block: Option<serde_json::Value>,
    index: Option<u64>,
    error: Option<StreamErrorData>,
}

#[derive(Deserialize)]
struct StreamDelta {
    #[serde(rename = "type")]
    delta_type: Option<String>,
    text: Option<String>,
    stop_reason: Option<String>,
}

#[derive(Deserialize)]
struct StreamUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

#[derive(Deserialize)]
struct StreamMessage {
    usage: Option<StreamUsage>,
}

#[derive(Deserialize)]
struct StreamErrorData {
    message: Option<String>,
}

impl ClaudeClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: "https://api.anthropic.com".to_string(),
        }
    }

    #[cfg(test)]
    pub fn with_base_url(base_url: &str) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: base_url.to_string(),
        }
    }

    pub async fn complete(
        &self,
        api_key: &str,
        system_prompt: &str,
        user_message: &str,
        max_tokens: u32,
    ) -> Result<String, ClaudeClientError> {
        let request = MessagesRequest {
            model: DEFAULT_MODEL.to_string(),
            max_tokens,
            system: system_prompt.to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: user_message.to_string(),
            }],
            stream: None,
        };

        let url = format!("{}/v1/messages", self.base_url);
        info!(
            model = DEFAULT_MODEL,
            max_tokens,
            user_msg_len = user_message.len(),
            url = %url,
            "Sending Claude API request"
        );
        let start = std::time::Instant::now();

        let response = self
            .http
            .post(&url)
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_API_VERSION)
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                error!(elapsed_ms = start.elapsed().as_millis() as u64, error = %e, "Claude HTTP request failed");
                e
            })?;

        let status = response.status();
        let elapsed_ms = start.elapsed().as_millis() as u64;
        info!(status = status.as_u16(), elapsed_ms, "Claude API responded");

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            error!(status = status.as_u16(), body = %body, "Claude API error response");
            return Err(ClaudeClientError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let body: MessagesResponse = response
            .json()
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to deserialize Claude response body");
                ClaudeClientError::Parse(e.to_string())
            })?;

        let stop_reason = body.stop_reason.as_deref().unwrap_or("unknown");
        info!(stop_reason, "Claude stop_reason");

        if stop_reason == "max_tokens" {
            error!(max_tokens, "Claude response truncated — hit max_tokens limit");
            return Err(ClaudeClientError::Truncated { max_tokens });
        }

        let text = body
            .content
            .into_iter()
            .filter_map(|block| block.text)
            .collect::<Vec<_>>()
            .join("");

        if text.is_empty() {
            error!("Claude returned empty text content");
            return Err(ClaudeClientError::Parse(
                "no text content in response".into(),
            ));
        }

        debug!(response_len = text.len(), "Claude response text extracted");
        Ok(text)
    }

    /// Streaming variant of `complete()`. Sends token deltas to `event_tx` as they
    /// arrive from the Anthropic SSE stream, then returns the accumulated full text.
    pub async fn complete_stream(
        &self,
        api_key: &str,
        system_prompt: &str,
        user_message: &str,
        max_tokens: u32,
        event_tx: mpsc::UnboundedSender<ClaudeStreamEvent>,
    ) -> Result<String, ClaudeClientError> {
        let request = MessagesRequest {
            model: DEFAULT_MODEL.to_string(),
            max_tokens,
            system: system_prompt.to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: user_message.to_string(),
            }],
            stream: Some(true),
        };

        let url = format!("{}/v1/messages", self.base_url);
        info!(
            model = DEFAULT_MODEL,
            max_tokens,
            user_msg_len = user_message.len(),
            url = %url,
            "Sending streaming Claude API request"
        );
        let start = std::time::Instant::now();

        let response = self
            .http
            .post(&url)
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_API_VERSION)
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                error!(elapsed_ms = start.elapsed().as_millis() as u64, error = %e, "Claude streaming HTTP request failed");
                e
            })?;

        let status = response.status();
        let elapsed_ms = start.elapsed().as_millis() as u64;
        info!(status = status.as_u16(), elapsed_ms, "Claude streaming API responded");

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            error!(status = status.as_u16(), body = %body, "Claude API error response");
            return Err(ClaudeClientError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        use futures_core::StreamExt as _;
        // Not available—use reqwest's bytes_stream with tokio_stream
        let mut byte_stream = response.bytes_stream();

        let mut line_buf = String::new();
        let mut current_event_type = String::new();
        let mut accumulated_text = String::new();
        let mut input_tokens: u64 = 0;
        let mut output_tokens: u64 = 0;
        let mut stop_reason = String::from("end_turn");

        use futures_core::stream::Stream as _;
        use std::pin::Pin;
        use std::task::{Context, Poll};

        let mut pinned = std::pin::pin!(byte_stream);

        loop {
            let chunk = {
                use futures_core::Stream;
                let mut cx = std::task::Context::from_waker(futures_core::task::noop_waker_ref());
                // We need to poll in an async context; use a helper approach instead
                break; // placeholder, we'll restructure
            };
        }

        // Actually, let's use tokio_stream's StreamExt which provides next()
        // reqwest bytes_stream returns impl Stream<Item = Result<Bytes, reqwest::Error>>
        // We need to iterate over it asynchronously. We can use `while let` with StreamExt.

        // Since futures_core::Stream doesn't have .next(), use tokio_stream's StreamExt
        use tokio_stream::StreamExt;
        let mut byte_stream = tokio_stream::StreamExt::map(
            response.bytes_stream(),
            |r| r,
        );

        // Hmm, we already consumed response above. Let me restructure.
        // Actually the response was consumed above. Let me fix this.

        todo!("restructure")
    }
}

impl Default for ClaudeClient {
    fn default() -> Self {
        Self::new()
    }
}
