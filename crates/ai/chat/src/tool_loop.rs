use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::mpsc;
use tracing::{info, warn};

use aura_claude::{
    ClaudeStreamEvent, ContentBlock, RichMessage, ThinkingConfig, ToolCall, ToolDefinition,
};
use aura_billing::MeteredLlm;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

pub struct ToolLoopConfig {
    pub max_iterations: usize,
    pub max_tokens: u32,
    pub thinking: Option<ThinkingConfig>,
    pub stream_timeout: Duration,
    pub billing_reason: &'static str,
}

// ---------------------------------------------------------------------------
// Tool execution trait -- callers implement this
// ---------------------------------------------------------------------------

pub struct ToolCallResult {
    pub tool_use_id: String,
    pub content: String,
    pub is_error: bool,
    /// When true the loop will break after processing all results in this batch.
    pub stop_loop: bool,
}

#[async_trait]
pub trait ToolExecutor: Send + Sync {
    async fn execute(&self, tool_calls: &[ToolCall]) -> Vec<ToolCallResult>;
}

// ---------------------------------------------------------------------------
// Stream events emitted by the loop
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub enum ToolLoopEvent {
    Delta(String),
    ThinkingDelta(String),
    ToolUseDetected {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        tool_name: String,
        content: String,
        is_error: bool,
    },
    IterationTokenUsage {
        input_tokens: u64,
        output_tokens: u64,
    },
    Error(String),
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

pub struct ToolLoopResult {
    pub text: String,
    pub thinking: String,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub iterations_run: usize,
    pub timed_out: bool,
    pub insufficient_credits: bool,
}

// ---------------------------------------------------------------------------
// The loop itself
// ---------------------------------------------------------------------------

pub async fn run_tool_loop(
    llm: Arc<MeteredLlm>,
    api_key: &str,
    system_prompt: &str,
    initial_messages: Vec<RichMessage>,
    tools: Vec<ToolDefinition>,
    config: &ToolLoopConfig,
    executor: &dyn ToolExecutor,
    event_tx: &mpsc::UnboundedSender<ToolLoopEvent>,
) -> ToolLoopResult {
    let mut api_messages = initial_messages;
    let mut total_text = String::new();
    let mut total_thinking = String::new();
    let mut total_input_tokens: u64 = 0;
    let mut total_output_tokens: u64 = 0;

    for iteration in 0..config.max_iterations {
        let (claude_tx, mut claude_rx) = mpsc::unbounded_channel::<ClaudeStreamEvent>();

        let llm_clone = llm.clone();
        let api_key_owned = api_key.to_string();
        let system_owned = system_prompt.to_string();
        let msgs_owned = api_messages.clone();
        let tools_owned = tools.clone();
        let max_tokens = config.max_tokens;
        let thinking = config.thinking.clone();
        let reason = config.billing_reason;

        let stream_handle = tokio::spawn(async move {
            if let Some(thinking) = thinking {
                llm_clone
                    .complete_stream_with_tools_thinking(
                        &api_key_owned,
                        &system_owned,
                        msgs_owned,
                        tools_owned,
                        max_tokens,
                        thinking,
                        claude_tx,
                        reason,
                        None,
                    )
                    .await
            } else {
                llm_clone
                    .complete_stream_with_tools(
                        &api_key_owned,
                        &system_owned,
                        msgs_owned,
                        tools_owned,
                        max_tokens,
                        claude_tx,
                        reason,
                        None,
                    )
                    .await
            }
        });

        let mut iter_text = String::new();
        let mut iter_tool_calls: Vec<ToolCall> = Vec::new();

        let iter_timed_out = loop {
            match tokio::time::timeout(config.stream_timeout, claude_rx.recv()).await {
                Ok(Some(evt)) => match evt {
                    ClaudeStreamEvent::Delta(text) => {
                        iter_text.push_str(&text);
                        let _ = event_tx.send(ToolLoopEvent::Delta(text));
                    }
                    ClaudeStreamEvent::ToolUse { id, name, input } => {
                        let _ = event_tx.send(ToolLoopEvent::ToolUseDetected {
                            id: id.clone(),
                            name: name.clone(),
                            input: input.clone(),
                        });
                        iter_tool_calls.push(ToolCall { id, name, input });
                    }
                    ClaudeStreamEvent::ThinkingDelta(text) => {
                        total_thinking.push_str(&text);
                        let _ = event_tx.send(ToolLoopEvent::ThinkingDelta(text));
                    }
                    ClaudeStreamEvent::Done { stop_reason, .. } => {
                        info!(iteration, stop_reason = %stop_reason, tool_calls = iter_tool_calls.len(), "Tool loop iteration done");
                    }
                    ClaudeStreamEvent::Error(msg) => {
                        let _ = event_tx.send(ToolLoopEvent::Error(msg));
                    }
                },
                Ok(None) => break false,
                Err(_) => {
                    warn!(iteration, "Tool loop streaming timed out after {}s", config.stream_timeout.as_secs());
                    stream_handle.abort();
                    break true;
                }
            }
        };

        if iter_timed_out {
            let _ = event_tx.send(ToolLoopEvent::Error(
                "LLM streaming timed out".to_string(),
            ));
            append_text(&mut total_text, &iter_text);
            return ToolLoopResult {
                text: total_text,
                thinking: total_thinking,
                total_input_tokens,
                total_output_tokens,
                iterations_run: iteration + 1,
                timed_out: true,
                insufficient_credits: false,
            };
        }

        let stream_result = match stream_handle.await {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => {
                let is_credits = e.is_insufficient_credits();
                if is_credits {
                    let _ = event_tx.send(ToolLoopEvent::Error(
                        "Insufficient credits — please top up to continue.".to_string(),
                    ));
                } else if iter_text.is_empty() && iter_tool_calls.is_empty() {
                    let _ = event_tx.send(ToolLoopEvent::Error(format!("LLM error: {e}")));
                }
                append_text(&mut total_text, &iter_text);
                return ToolLoopResult {
                    text: total_text,
                    thinking: total_thinking,
                    total_input_tokens,
                    total_output_tokens,
                    iterations_run: iteration + 1,
                    timed_out: false,
                    insufficient_credits: is_credits,
                };
            }
            Err(e) => {
                if iter_text.is_empty() && iter_tool_calls.is_empty() {
                    let _ = event_tx.send(ToolLoopEvent::Error(format!("Stream task error: {e}")));
                }
                append_text(&mut total_text, &iter_text);
                return ToolLoopResult {
                    text: total_text,
                    thinking: total_thinking,
                    total_input_tokens,
                    total_output_tokens,
                    iterations_run: iteration + 1,
                    timed_out: false,
                    insufficient_credits: false,
                };
            }
        };

        total_input_tokens += stream_result.input_tokens;
        total_output_tokens += stream_result.output_tokens;
        let _ = event_tx.send(ToolLoopEvent::IterationTokenUsage {
            input_tokens: total_input_tokens,
            output_tokens: total_output_tokens,
        });

        append_text(&mut total_text, &iter_text);

        if stream_result.stop_reason != "tool_use" || iter_tool_calls.is_empty() {
            return ToolLoopResult {
                text: total_text,
                thinking: total_thinking,
                total_input_tokens,
                total_output_tokens,
                iterations_run: iteration + 1,
                timed_out: false,
                insufficient_credits: false,
            };
        }

        // -- Build assistant blocks for the conversation ----------------------
        let mut assistant_blocks: Vec<ContentBlock> = Vec::new();
        if !iter_text.is_empty() {
            assistant_blocks.push(ContentBlock::Text {
                text: iter_text.clone(),
            });
        }
        for tc in &iter_tool_calls {
            assistant_blocks.push(ContentBlock::ToolUse {
                id: tc.id.clone(),
                name: tc.name.clone(),
                input: tc.input.clone(),
            });
        }
        api_messages.push(RichMessage::assistant_blocks(assistant_blocks));

        // -- Execute tool calls -----------------------------------------------
        let results = executor.execute(&iter_tool_calls).await;

        let mut should_stop = false;
        let mut result_blocks: Vec<ContentBlock> = Vec::new();
        for (tc, result) in iter_tool_calls.iter().zip(&results) {
            let _ = event_tx.send(ToolLoopEvent::ToolResult {
                tool_use_id: result.tool_use_id.clone(),
                tool_name: tc.name.clone(),
                content: result.content.clone(),
                is_error: result.is_error,
            });
            result_blocks.push(ContentBlock::ToolResult {
                tool_use_id: result.tool_use_id.clone(),
                content: result.content.clone(),
                is_error: if result.is_error { Some(true) } else { None },
            });
            if result.stop_loop {
                should_stop = true;
            }
        }
        api_messages.push(RichMessage::tool_results(result_blocks));

        if should_stop {
            return ToolLoopResult {
                text: total_text,
                thinking: total_thinking,
                total_input_tokens,
                total_output_tokens,
                iterations_run: iteration + 1,
                timed_out: false,
                insufficient_credits: false,
            };
        }

        if iteration + 1 >= config.max_iterations {
            warn!(
                config.max_iterations,
                "Tool-use loop hit max iterations, stopping"
            );
        }
    }

    ToolLoopResult {
        text: total_text,
        thinking: total_thinking,
        total_input_tokens,
        total_output_tokens,
        iterations_run: config.max_iterations,
        timed_out: false,
        insufficient_credits: false,
    }
}

fn append_text(total: &mut String, new: &str) {
    if !new.is_empty() {
        if !total.is_empty() {
            total.push_str("\n\n");
        }
        total.push_str(new);
    }
}
