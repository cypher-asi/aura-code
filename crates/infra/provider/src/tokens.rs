//! Token estimation utilities.

use crate::types::{ContentBlock, Message, MessageContent};

/// Approximate token count for a text string (~4 characters per token).
pub fn estimate_tokens(text: &str) -> u64 {
    (text.len() as u64).div_ceil(4)
}

/// Estimate token count for a [`Message`].
pub fn estimate_message_tokens(msg: &Message) -> u64 {
    match &msg.content {
        MessageContent::Text(t) => estimate_tokens(t) + 4,
        MessageContent::Blocks(blocks) => {
            let mut total: u64 = 4;
            for block in blocks {
                total += match block {
                    ContentBlock::Text { text } => estimate_tokens(text),
                    ContentBlock::Image { source } => 1000 + (source.data.len() as u64 / 4),
                    ContentBlock::ToolUse { name, input, .. } => {
                        estimate_tokens(name) + estimate_tokens(&input.to_string()) + 10
                    }
                    ContentBlock::ToolResult { content, .. } => estimate_tokens(content) + 10,
                };
            }
            total
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estimate_tokens_basic() {
        assert_eq!(estimate_tokens(""), 0);
        assert_eq!(estimate_tokens("abcd"), 1);
        assert_eq!(estimate_tokens("abcde"), 2);
    }

    #[test]
    fn estimate_message_tokens_text() {
        let msg = Message::user("hello world");
        let tokens = estimate_message_tokens(&msg);
        assert!(tokens > 0);
    }
}
