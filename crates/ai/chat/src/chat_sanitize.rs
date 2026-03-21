use std::collections::HashSet;

use tracing::warn;

use aura_claude::{ContentBlock, MessageContent, RichMessage};

// ── Shared helpers ──────────────────────────────────────────────────

fn tool_use_ids_from_blocks(blocks: &[ContentBlock]) -> Vec<String> {
    blocks
        .iter()
        .filter_map(|b| match b {
            ContentBlock::ToolUse { id, .. } => Some(id.clone()),
            _ => None,
        })
        .collect()
}

fn tool_result_ids_from_blocks(blocks: &[ContentBlock]) -> HashSet<String> {
    blocks
        .iter()
        .filter_map(|b| match b {
            ContentBlock::ToolResult { tool_use_id, .. } => Some(tool_use_id.clone()),
            _ => None,
        })
        .collect()
}

// ── sanitize_orphan_tool_results helpers ────────────────────────────

/// Collect tool_use IDs from the message immediately preceding `index`.
fn collect_valid_tool_use_ids(messages: &[RichMessage], index: usize) -> HashSet<String> {
    match messages.get(index.wrapping_sub(1)) {
        Some(prev) if prev.role == "assistant" => match &prev.content {
            MessageContent::Blocks(prev_blocks) => {
                tool_use_ids_from_blocks(prev_blocks).into_iter().collect()
            }
            _ => HashSet::new(),
        },
        _ => HashSet::new(),
    }
}

/// Build a replacement message after filtering tool_result blocks.
/// Returns `None` when the original message should be kept as-is.
fn rebuild_filtered_message(
    blocks: &[ContentBlock],
    kept: Vec<ContentBlock>,
    other_blocks: Vec<ContentBlock>,
    orig_count: usize,
) -> Option<RichMessage> {
    if kept.is_empty() && other_blocks.is_empty() {
        let preview: String = blocks
            .iter()
            .filter_map(|b| match b {
                ContentBlock::ToolResult { content, .. } => Some(content.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(200)
            .collect();
        warn!(preview = %preview, "Converting orphan tool_result message to text");
        Some(RichMessage::user(&format!(
            "[Previous tool result was lost due to context: {}]",
            preview
        )))
    } else if kept.len() != orig_count {
        let mut new_blocks = other_blocks;
        new_blocks.extend(kept);
        Some(RichMessage {
            role: "user".into(),
            content: MessageContent::Blocks(new_blocks),
        })
    } else {
        None
    }
}

/// Remove orphan tool_result blocks whose matching tool_use no longer exists
/// in the preceding assistant message (e.g. after context compaction).
pub(crate) fn sanitize_orphan_tool_results(messages: Vec<RichMessage>) -> Vec<RichMessage> {
    let mut result = Vec::with_capacity(messages.len());
    for i in 0..messages.len() {
        let msg = &messages[i];
        let MessageContent::Blocks(blocks) = &msg.content else {
            result.push(msg.clone());
            continue;
        };
        let tool_result_blocks: Vec<_> = blocks
            .iter()
            .filter(|b| matches!(b, ContentBlock::ToolResult { .. }))
            .cloned()
            .collect();
        if tool_result_blocks.is_empty() || msg.role != "user" {
            result.push(msg.clone());
            continue;
        }
        let orig_count = tool_result_blocks.len();
        let valid_ids = collect_valid_tool_use_ids(&messages, i);
        let kept: Vec<ContentBlock> = tool_result_blocks
            .into_iter()
            .filter_map(|b| match &b {
                ContentBlock::ToolResult { tool_use_id, .. }
                    if valid_ids.contains(tool_use_id) =>
                {
                    Some(b)
                }
                ContentBlock::ToolResult { tool_use_id, .. } => {
                    warn!(tool_use_id, "Dropping orphan tool_result");
                    None
                }
                _ => None,
            })
            .collect();
        let other_blocks: Vec<ContentBlock> = blocks
            .iter()
            .filter(|b| !matches!(b, ContentBlock::ToolResult { .. }))
            .cloned()
            .collect();
        match rebuild_filtered_message(blocks, kept, other_blocks, orig_count) {
            Some(replacement) => result.push(replacement),
            None => result.push(msg.clone()),
        }
    }
    result
}

// ── sanitize_tool_use_results helpers ───────────────────────────────

fn extract_tool_use_ids(msg: &RichMessage) -> Vec<String> {
    match &msg.content {
        MessageContent::Blocks(blocks) => tool_use_ids_from_blocks(blocks),
        MessageContent::Text(_) => vec![],
    }
}

fn collect_existing_result_ids(next_msg: Option<&RichMessage>) -> HashSet<String> {
    match next_msg {
        Some(m) if m.role == "user" => match &m.content {
            MessageContent::Blocks(blocks) => tool_result_ids_from_blocks(blocks),
            _ => HashSet::new(),
        },
        _ => HashSet::new(),
    }
}

/// Inject synthetic error results for missing tool_use IDs.
/// Returns the messages to append and whether the next message was consumed.
fn inject_missing_tool_results(
    missing_ids: Vec<String>,
    next_msg: Option<&RichMessage>,
) -> (Vec<RichMessage>, bool) {
    warn!(
        orphaned_count = missing_ids.len(),
        ids = ?missing_ids,
        "Adding synthetic tool_result for orphaned tool_use"
    );
    let synthetic: Vec<ContentBlock> = missing_ids
        .into_iter()
        .map(|tool_use_id| ContentBlock::ToolResult {
            tool_use_id: tool_use_id.clone(),
            content: "Tool execution was interrupted or not completed.".to_string(),
            is_error: Some(true),
        })
        .collect();

    if let Some(m) = next_msg {
        if m.role == "user" {
            let merged = match &m.content {
                MessageContent::Blocks(blocks) => {
                    let mut merged = blocks.clone();
                    merged.extend(synthetic);
                    merged
                }
                MessageContent::Text(text) => {
                    let mut merged = vec![ContentBlock::Text { text: text.clone() }];
                    merged.extend(synthetic);
                    merged
                }
            };
            return (
                vec![RichMessage {
                    role: "user".into(),
                    content: MessageContent::Blocks(merged),
                }],
                true,
            );
        }
    }
    (vec![RichMessage::tool_results(synthetic)], false)
}

/// Ensure every tool_use block in an assistant message has a corresponding
/// tool_result in the next user message.  Injects synthetic error results
/// for any orphaned tool_use blocks.
pub(crate) fn sanitize_tool_use_results(messages: Vec<RichMessage>) -> Vec<RichMessage> {
    let mut result = Vec::with_capacity(messages.len() + 16);
    let mut i = 0;
    while i < messages.len() {
        let msg = &messages[i];
        let tool_use_ids = extract_tool_use_ids(msg);

        result.push(msg.clone());

        if tool_use_ids.is_empty() {
            i += 1;
            continue;
        }

        let next = messages.get(i + 1);
        let existing_ids = collect_existing_result_ids(next);

        let missing: Vec<String> = tool_use_ids
            .into_iter()
            .filter(|id| !existing_ids.contains(id))
            .collect();

        if !missing.is_empty() {
            let (to_append, consumed_next) = inject_missing_tool_results(missing, next);
            result.extend(to_append);
            if consumed_next {
                i += 2;
                continue;
            }
        }
        i += 1;
    }
    result
}

/// Validate and repair the message history before sending to the LLM API.
///
/// Checks performed (in order):
/// 1. Remove messages with empty content
/// 2. Merge consecutive same-role messages (Claude requires alternation)
/// 3. Ensure every tool_use has a matching tool_result (via existing sanitizers)
/// 4. Ensure the conversation starts with a user message
///
/// This is called as a final safety net before every API call to prevent
/// 400 errors from invalid message structure.
pub(crate) fn validate_and_repair_messages(messages: Vec<RichMessage>) -> Vec<RichMessage> {
    let messages = remove_empty_messages(messages);
    let messages = merge_consecutive_same_role(messages);
    let messages = sanitize_orphan_tool_results(messages);
    let messages = sanitize_tool_use_results(messages);
    ensure_starts_with_user(messages)
}

/// Drop messages that have no meaningful content.
fn remove_empty_messages(messages: Vec<RichMessage>) -> Vec<RichMessage> {
    messages
        .into_iter()
        .filter(|msg| {
            match &msg.content {
                MessageContent::Text(t) => !t.is_empty(),
                MessageContent::Blocks(blocks) => {
                    if blocks.is_empty() {
                        warn!(role = %msg.role, "Dropping message with empty blocks");
                        return false;
                    }
                    // Keep if any block has content
                    blocks.iter().any(|b| match b {
                        ContentBlock::Text { text } => !text.is_empty(),
                        ContentBlock::ToolUse { .. } => true,
                        ContentBlock::ToolResult { content, .. } => !content.is_empty(),
                        _ => true,
                    })
                }
            }
        })
        .collect()
}

/// Public entry point for merging consecutive same-role messages,
/// used by `sanitize_after_compaction` in tool_loop.rs.
pub(crate) fn merge_consecutive_same_role_pub(messages: Vec<RichMessage>) -> Vec<RichMessage> {
    merge_consecutive_same_role(messages)
}

/// Claude requires strict user/assistant alternation.  When compaction
/// or other mutations produce consecutive messages with the same role,
/// merge them into a single message.
fn merge_consecutive_same_role(messages: Vec<RichMessage>) -> Vec<RichMessage> {
    if messages.is_empty() {
        return messages;
    }
    let mut result: Vec<RichMessage> = Vec::with_capacity(messages.len());
    for msg in messages {
        let should_merge = result
            .last()
            .map(|prev| prev.role == msg.role)
            .unwrap_or(false);
        if should_merge {
            if let Some(prev) = result.last_mut() {
                merge_into(prev, msg);
            }
        } else {
            result.push(msg);
        }
    }
    result
}

/// Merge `src` message content into `dst` (same role).
fn merge_into(dst: &mut RichMessage, src: RichMessage) {
    warn!(role = %dst.role, "Merging consecutive same-role messages");
    match (&mut dst.content, src.content) {
        (MessageContent::Text(dst_text), MessageContent::Text(src_text)) => {
            dst_text.push('\n');
            dst_text.push_str(&src_text);
        }
        (MessageContent::Blocks(dst_blocks), MessageContent::Blocks(src_blocks)) => {
            dst_blocks.extend(src_blocks);
        }
        (dst_content, src_content) => {
            let mut dst_blocks = content_to_blocks(std::mem::replace(
                dst_content,
                MessageContent::Blocks(vec![]),
            ));
            dst_blocks.extend(content_to_blocks(src_content));
            *dst_content = MessageContent::Blocks(dst_blocks);
        }
    }
}

fn content_to_blocks(content: MessageContent) -> Vec<ContentBlock> {
    match content {
        MessageContent::Blocks(b) => b,
        MessageContent::Text(t) => vec![ContentBlock::Text { text: t }],
    }
}

/// Ensure the message list starts with a user message.
fn ensure_starts_with_user(mut messages: Vec<RichMessage>) -> Vec<RichMessage> {
    if let Some(first) = messages.first() {
        if first.role != "user" {
            warn!(
                role = %first.role,
                "Message history does not start with a user message, prepending placeholder"
            );
            messages.insert(0, RichMessage::user("Continue."));
        }
    }
    messages
}

#[cfg(test)]
#[path = "chat_sanitize_tests.rs"]
mod tests;
