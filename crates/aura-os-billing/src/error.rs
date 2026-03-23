use thiserror::Error;

#[derive(Debug, Error)]
pub enum BillingError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),

    #[error("Billing server returned {status}: {body}")]
    ServerError { status: u16, body: String },

    #[error("Deserialization error: {0}")]
    Deserialize(String),

    #[error("Insufficient credits: balance_cents={balance_cents}")]
    InsufficientCredits { balance_cents: i64 },
}
