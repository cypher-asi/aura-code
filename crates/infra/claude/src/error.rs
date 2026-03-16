#[derive(Debug, thiserror::Error)]
pub enum ClaudeClientError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("API error {status}: {message}")]
    Api { status: u16, message: String },
    #[error("response truncated: output hit max_tokens limit ({max_tokens}). Increase MAX_TOKENS or reduce input size.")]
    Truncated { max_tokens: u32 },
    #[error("response parse error: {0}")]
    Parse(String),
}
