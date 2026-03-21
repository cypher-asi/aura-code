//! Provider error types.

/// Errors that can occur during provider operations.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    /// HTTP-level transport error.
    #[error("HTTP error: {0}")]
    Http(String),

    /// The provider API returned an error response.
    #[error("API error {status}: {message}")]
    Api {
        /// HTTP status code.
        status: u16,
        /// Error message from the API.
        message: String,
    },

    /// The model is temporarily overloaded.
    #[error("model temporarily overloaded")]
    Overloaded,

    /// Response was truncated due to token limits.
    #[error("response truncated at {max_tokens} tokens")]
    Truncated {
        /// The max_tokens limit that was hit.
        max_tokens: u32,
    },

    /// Failed to parse the provider response.
    #[error("parse error: {0}")]
    Parse(String),

    /// The account has insufficient credits to continue.
    #[error("insufficient credits")]
    InsufficientCredits,

    /// Serialization or deserialization error.
    #[error("serialization error: {0}")]
    Serialization(String),
}
