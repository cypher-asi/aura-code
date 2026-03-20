use aura_claude::ClaudeClientError;
use aura_storage::StorageError;

#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    #[error("storage error: {0}")]
    Storage(#[from] StorageError),
    #[error("session not found")]
    NotFound,
    #[error("parse error: {0}")]
    Parse(String),
    #[error("Claude API error: {0}")]
    Claude(ClaudeClientError),
    #[error("insufficient credits")]
    InsufficientCredits,
}

impl From<ClaudeClientError> for SessionError {
    fn from(e: ClaudeClientError) -> Self {
        match e {
            ClaudeClientError::InsufficientCredits => SessionError::InsufficientCredits,
            other => SessionError::Claude(other),
        }
    }
}
