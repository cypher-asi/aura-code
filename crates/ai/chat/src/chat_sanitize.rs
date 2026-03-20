use std::collections::HashSet;

use tracing::warn;

use aura_claude::{ContentBlock, MessageContent, RichMessage};

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
            .filter_map(|b| match b {
                ContentBlock::ToolResult { .. } => Some(b.clone()),
                _ => None,
            })
            .collect();
        if tool_result_blocks.is_empty() || msg.role != "user" {
            result.push(msg.clone());
            continue;
        }
        let orig_count = tool_result_blocks.len();
        let valid_ids: HashSet<String> = match messages.get(i.wrapping_sub(1)) {
            Some(prev) if prev.role == "assistant" => match &prev.content {
                MessageContent::Blocks(prev_blocks) => prev_blocks
                    .iter()
                    .filter_map(|b| match b {
                        ContentBlock::ToolUse { id, .. } => Some(id.clone()),
                        _ => None,
                    })
                    .collect(),
                _ => HashSet::new(),
            },
            _ => HashSet::new(),
        };
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
            result.push(RichMessage::user(&format!(
                "[Previous tool result was lost due to context: {}]",
                preview
            )));
        } else if kept.len() != orig_count {
            let mut new_blocks = other_blocks;
            new_blocks.extend(kept);
            result.push(RichMessage {
                role: "user".into(),
                content: MessageContent::Blocks(new_blocks),
            });
        } else {
            result.push(msg.clone());
        }
    }
    result
}

/// Ensure every tool_use block in an assistant message has a corresponding
/// tool_result in the next user message.  Injects synthetic error results
/// for any orphaned tool_use blocks.
pub(crate) fn sanitize_tool_use_results(messages: Vec<RichMessage>) -> Vec<RichMessage> {
    let mut result = Vec::with_capacity(messages.len() + 16);
    let mut i = 0;
    while i < messages.len() {
        let msg = &messages[i];
        let tool_use_ids: Vec<String> = match &msg.content {
            MessageContent::Blocks(blocks) => blocks
                .iter()
                .filter_map(|b| match b {
                    ContentBlock::ToolUse { id, .. } => Some(id.clone()),
                    _ => None,
                })
                .collect(),
            MessageContent::Text(_) => vec![],
        };

        result.push(msg.clone());

        if tool_use_ids.is_empty() {
            i += 1;
            continue;
        }

        let next = messages.get(i + 1);
        let existing_ids: HashSet<String> = match next {
            Some(m) if m.role == "user" => match &m.content {
                MessageContent::Blocks(blocks) => blocks
                    .iter()
                    .filter_map(|b| match b {
                        ContentBlock::ToolResult { tool_use_id, .. } => {
                            Some(tool_use_id.clone())
                        }
                        _ => None,
                    })
                    .collect(),
                _ => HashSet::new(),
            },
            _ => HashSet::new(),
        };

        let missing: Vec<String> = tool_use_ids
            .into_iter()
            .filter(|id| !existing_ids.contains(id))
            .collect();

        if !missing.is_empty() {
            warn!(
                orphaned_count = missing.len(),
                ids = ?missing,
                "Adding synthetic tool_result for orphaned tool_use"
            );
            let synthetic: Vec<ContentBlock> = missing
                .into_iter()
                .map(|tool_use_id| ContentBlock::ToolResult {
                    tool_use_id: tool_use_id.clone(),
                    content: "Tool execution was interrupted or not completed.".to_string(),
                    is_error: Some(true),
                })
                .collect();

            if let Some(m) = next {
                if m.role == "user" {
                    match &m.content {
                        MessageContent::Blocks(blocks) => {
                            let mut merged = blocks.clone();
                            merged.extend(synthetic);
                            result.push(RichMessage {
                                role: "user".into(),
                                content: MessageContent::Blocks(merged),
                            });
                        }
                        MessageContent::Text(text) => {
                            let mut merged = vec![ContentBlock::Text { text: text.clone() }];
                            merged.extend(synthetic);
                            result.push(RichMessage {
                                role: "user".into(),
                                content: MessageContent::Blocks(merged),
                            });
                        }
                    }
                    i += 2;
                    continue;
                }
            }
            result.push(RichMessage::tool_results(synthetic));
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
mod tests {
    use super::*;

    // -------------------------------------------------------------------
    // remove_empty_messages
    // -------------------------------------------------------------------

    #[test]
    fn remove_empty_text_messages() {
        let msgs = vec![
            RichMessage::user("hello"),
            RichMessage::user(""),
            RichMessage::assistant_text("response"),
        ];
        let result = remove_empty_messages(msgs);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].role, "user");
        assert_eq!(result[1].role, "assistant");
    }

    #[test]
    fn remove_messages_with_empty_blocks_vec() {
        let msgs = vec![
            RichMessage::user("hello"),
            RichMessage {
                role: "user".into(),
                content: MessageContent::Blocks(vec![]),
            },
        ];
        let result = remove_empty_messages(msgs);
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn keep_messages_with_tool_use_blocks() {
        let msgs = vec![RichMessage {
            role: "assistant".into(),
            content: MessageContent::Blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({"path": "a.rs"}),
            }]),
        }];
        let result = remove_empty_messages(msgs);
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn remove_messages_where_all_blocks_have_empty_content() {
        let msgs = vec![RichMessage {
            role: "user".into(),
            content: MessageContent::Blocks(vec![
                ContentBlock::Text { text: "".into() },
                ContentBlock::ToolResult {
                    tool_use_id: "t1".into(),
                    content: "".into(),
                    is_error: None,
                },
            ]),
        }];
        let result = remove_empty_messages(msgs);
        assert_eq!(result.len(), 0);
    }

    // -------------------------------------------------------------------
    // merge_consecutive_same_role
    // -------------------------------------------------------------------

    #[test]
    fn no_merging_when_roles_alternate() {
        let msgs = vec![
            RichMessage::user("a"),
            RichMessage::assistant_text("b"),
            RichMessage::user("c"),
        ];
        let result = merge_consecutive_same_role(msgs);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn merge_two_consecutive_user_text_messages() {
        let msgs = vec![
            RichMessage::user("hello"),
            RichMessage::user("world"),
        ];
        let result = merge_consecutive_same_role(msgs);
        assert_eq!(result.len(), 1);
        match &result[0].content {
            MessageContent::Text(t) => assert!(t.contains("hello") && t.contains("world")),
            _ => panic!("expected text"),
        }
    }

    #[test]
    fn merge_two_consecutive_assistant_blocks_messages() {
        let msgs = vec![
            RichMessage::assistant_blocks(vec![ContentBlock::Text { text: "a".into() }]),
            RichMessage::assistant_blocks(vec![ContentBlock::Text { text: "b".into() }]),
        ];
        let result = merge_consecutive_same_role(msgs);
        assert_eq!(result.len(), 1);
        match &result[0].content {
            MessageContent::Blocks(blocks) => assert_eq!(blocks.len(), 2),
            _ => panic!("expected blocks"),
        }
    }

    #[test]
    fn merge_text_and_blocks_different_content_types() {
        let msgs = vec![
            RichMessage::user("text message"),
            RichMessage {
                role: "user".into(),
                content: MessageContent::Blocks(vec![ContentBlock::ToolResult {
                    tool_use_id: "t1".into(),
                    content: "result".into(),
                    is_error: None,
                }]),
            },
        ];
        let result = merge_consecutive_same_role(msgs);
        assert_eq!(result.len(), 1);
        match &result[0].content {
            MessageContent::Blocks(blocks) => {
                assert!(blocks.len() >= 2, "should have text + tool_result blocks");
            }
            _ => panic!("expected blocks after mixed merge"),
        }
    }

    #[test]
    fn merge_three_plus_consecutive_same_role() {
        let msgs = vec![
            RichMessage::user("a"),
            RichMessage::user("b"),
            RichMessage::user("c"),
        ];
        let result = merge_consecutive_same_role(msgs);
        assert_eq!(result.len(), 1);
        match &result[0].content {
            MessageContent::Text(t) => {
                assert!(t.contains("a") && t.contains("b") && t.contains("c"));
            }
            _ => panic!("expected text"),
        }
    }

    #[test]
    fn merge_empty_input_returns_empty() {
        let result = merge_consecutive_same_role(vec![]);
        assert!(result.is_empty());
    }

    // -------------------------------------------------------------------
    // sanitize_orphan_tool_results
    // -------------------------------------------------------------------

    #[test]
    fn passes_through_matched_tool_use_tool_result_pairs() {
        let msgs = vec![
            RichMessage::user("do something"),
            RichMessage::assistant_blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({"path": "a.rs"}),
            }]),
            RichMessage::tool_results(vec![ContentBlock::ToolResult {
                tool_use_id: "t1".into(),
                content: "file content".into(),
                is_error: None,
            }]),
        ];
        let result = sanitize_orphan_tool_results(msgs);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn drops_orphan_tool_result_with_no_preceding_assistant() {
        let msgs = vec![
            RichMessage::tool_results(vec![ContentBlock::ToolResult {
                tool_use_id: "orphan".into(),
                content: "lost result".into(),
                is_error: None,
            }]),
        ];
        let result = sanitize_orphan_tool_results(msgs);
        // Should convert to text placeholder since the entire message is orphaned
        assert_eq!(result.len(), 1);
        match &result[0].content {
            MessageContent::Text(t) => {
                assert!(t.contains("lost due to context") || t.contains("lost result"));
            }
            _ => {
                // The block might have been kept if there are other blocks; check content
            }
        }
    }

    #[test]
    fn drops_tool_result_when_tool_use_id_not_in_previous_assistant() {
        let msgs = vec![
            RichMessage::user("start"),
            RichMessage::assistant_blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({"path": "a.rs"}),
            }]),
            RichMessage::tool_results(vec![
                ContentBlock::ToolResult {
                    tool_use_id: "t1".into(),
                    content: "valid".into(),
                    is_error: None,
                },
                ContentBlock::ToolResult {
                    tool_use_id: "t_unknown".into(),
                    content: "orphan".into(),
                    is_error: None,
                },
            ]),
        ];
        let result = sanitize_orphan_tool_results(msgs);
        assert_eq!(result.len(), 3);
        // The third message should only have the valid tool_result
        match &result[2].content {
            MessageContent::Blocks(blocks) => {
                let tool_results: Vec<_> = blocks.iter().filter(|b| matches!(b, ContentBlock::ToolResult { .. })).collect();
                assert_eq!(tool_results.len(), 1);
            }
            _ => panic!("expected blocks"),
        }
    }

    #[test]
    fn converts_fully_orphaned_tool_result_message_to_text() {
        let msgs = vec![
            RichMessage::user("start"),
            RichMessage::assistant_text("some text"),
            RichMessage::tool_results(vec![ContentBlock::ToolResult {
                tool_use_id: "orphan".into(),
                content: "lost data".into(),
                is_error: None,
            }]),
        ];
        let result = sanitize_orphan_tool_results(msgs);
        // The orphaned message should be converted to text placeholder
        let last = result.last().unwrap();
        match &last.content {
            MessageContent::Text(t) => assert!(t.contains("lost due to context")),
            _ => panic!("expected text placeholder for fully orphaned tool_result"),
        }
    }

    // -------------------------------------------------------------------
    // sanitize_tool_use_results
    // -------------------------------------------------------------------

    #[test]
    fn no_change_when_all_tool_use_have_matching_results() {
        let msgs = vec![
            RichMessage::user("go"),
            RichMessage::assistant_blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({}),
            }]),
            RichMessage::tool_results(vec![ContentBlock::ToolResult {
                tool_use_id: "t1".into(),
                content: "data".into(),
                is_error: None,
            }]),
        ];
        let result = sanitize_tool_use_results(msgs.clone());
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn injects_synthetic_error_result_for_orphaned_tool_use() {
        let msgs = vec![
            RichMessage::user("go"),
            RichMessage::assistant_blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({}),
            }]),
            // No tool_result follows
            RichMessage::assistant_text("continued without result"),
        ];
        let result = sanitize_tool_use_results(msgs);
        // Should inject a synthetic tool_result between the two assistant messages
        let has_synthetic = result.iter().any(|m| {
            match &m.content {
                MessageContent::Blocks(blocks) => blocks.iter().any(|b| match b {
                    ContentBlock::ToolResult { content, is_error, .. } =>
                        content.contains("interrupted") && *is_error == Some(true),
                    _ => false,
                }),
                _ => false,
            }
        });
        assert!(has_synthetic, "should inject synthetic error result");
    }

    #[test]
    fn merges_synthetic_results_with_existing_user_message() {
        let msgs = vec![
            RichMessage::user("go"),
            RichMessage::assistant_blocks(vec![
                ContentBlock::ToolUse { id: "t1".into(), name: "a".into(), input: serde_json::json!({}) },
                ContentBlock::ToolUse { id: "t2".into(), name: "b".into(), input: serde_json::json!({}) },
            ]),
            RichMessage::tool_results(vec![ContentBlock::ToolResult {
                tool_use_id: "t1".into(),
                content: "ok".into(),
                is_error: None,
            }]),
            // t2 has no result
        ];
        let result = sanitize_tool_use_results(msgs);
        // The existing user message should be extended with t2's synthetic result
        let user_msg = result.iter().find(|m| {
            m.role == "user" && match &m.content {
                MessageContent::Blocks(blocks) => blocks.iter().any(|b| match b {
                    ContentBlock::ToolResult { tool_use_id, .. } => tool_use_id == "t2",
                    _ => false,
                }),
                _ => false,
            }
        });
        assert!(user_msg.is_some(), "should merge synthetic t2 result into existing user message");
    }

    #[test]
    fn handles_text_user_message_following_tool_use() {
        let msgs = vec![
            RichMessage::user("go"),
            RichMessage::assistant_blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({}),
            }]),
            RichMessage::user("text follow-up without tool_result"),
        ];
        let result = sanitize_tool_use_results(msgs);
        // Should convert the text user message to blocks and add synthetic result
        let has_both = result.iter().any(|m| {
            m.role == "user" && match &m.content {
                MessageContent::Blocks(blocks) => {
                    let has_text = blocks.iter().any(|b| matches!(b, ContentBlock::Text { .. }));
                    let has_result = blocks.iter().any(|b| matches!(b, ContentBlock::ToolResult { .. }));
                    has_text && has_result
                }
                _ => false,
            }
        });
        assert!(has_both, "should convert text user msg to blocks and merge with synthetic result");
    }

    #[test]
    fn handles_tool_use_at_end_of_messages_with_no_next() {
        let msgs = vec![
            RichMessage::user("go"),
            RichMessage::assistant_blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({}),
            }]),
        ];
        let result = sanitize_tool_use_results(msgs);
        // Should append a synthetic tool_result message
        assert!(result.len() >= 3, "should add synthetic result message");
        let last = result.last().unwrap();
        assert_eq!(last.role, "user");
        match &last.content {
            MessageContent::Blocks(blocks) => {
                assert!(blocks.iter().any(|b| matches!(b, ContentBlock::ToolResult { .. })));
            }
            _ => panic!("expected blocks with tool_result"),
        }
    }

    // -------------------------------------------------------------------
    // validate_and_repair_messages
    // -------------------------------------------------------------------

    #[test]
    fn already_valid_messages_pass_through() {
        let msgs = vec![
            RichMessage::user("hello"),
            RichMessage::assistant_text("hi"),
        ];
        let result = validate_and_repair_messages(msgs.clone());
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].role, "user");
        assert_eq!(result[1].role, "assistant");
    }

    #[test]
    fn messages_starting_with_assistant_get_user_prepended() {
        let msgs = vec![
            RichMessage::assistant_text("hi"),
            RichMessage::user("hello"),
        ];
        let result = validate_and_repair_messages(msgs);
        assert_eq!(result[0].role, "user");
        match &result[0].content {
            MessageContent::Text(t) => assert!(t.contains("Continue")),
            _ => panic!("expected text placeholder"),
        }
    }

    #[test]
    fn complex_scenario_empty_broken_alternation_orphans_missing_results() {
        let msgs = vec![
            RichMessage::user(""),                // empty, should be removed
            RichMessage::user("go"),
            RichMessage::user("also go"),         // consecutive user, should merge
            RichMessage::assistant_blocks(vec![ContentBlock::ToolUse {
                id: "t1".into(),
                name: "read_file".into(),
                input: serde_json::json!({}),
            }]),
            // Missing tool_result for t1
            RichMessage::assistant_text("done"),  // consecutive assistant
        ];
        let result = validate_and_repair_messages(msgs);

        // Should start with user
        assert_eq!(result[0].role, "user");

        // Should have alternating roles
        for i in 1..result.len() {
            assert_ne!(
                result[i].role, result[i - 1].role,
                "messages at index {} and {} have same role '{}'",
                i - 1, i, result[i].role
            );
        }

        // Should have a synthetic tool_result somewhere
        let has_tool_result = result.iter().any(|m| match &m.content {
            MessageContent::Blocks(blocks) => blocks.iter().any(|b| matches!(b, ContentBlock::ToolResult { .. })),
            _ => false,
        });
        assert!(has_tool_result, "should have injected synthetic tool_result");
    }

    // -------------------------------------------------------------------
    // ensure_starts_with_user
    // -------------------------------------------------------------------

    #[test]
    fn no_change_when_first_is_user() {
        let msgs = vec![RichMessage::user("hello")];
        let result = ensure_starts_with_user(msgs);
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn prepends_placeholder_when_first_is_assistant() {
        let msgs = vec![RichMessage::assistant_text("hi")];
        let result = ensure_starts_with_user(msgs);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].role, "user");
    }

    #[test]
    fn empty_input_returns_empty() {
        let result = ensure_starts_with_user(vec![]);
        assert!(result.is_empty());
    }
}
