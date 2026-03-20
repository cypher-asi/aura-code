mod debit;
mod llm_provider;
mod preflight;

#[cfg(test)]
mod tests;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use tokio::sync::{mpsc, Mutex};

use aura_claude::{
    ClaudeStreamEvent, LlmResponse, RichMessage, StreamTokenCapture,
    ThinkingConfig, ToolDefinition, ToolStreamResponse,
};
use aura_core::ZeroAuthSession;
use aura_store::RocksStore;

use crate::client::BillingClient;
use crate::pricing::PricingService;

const PRE_FLIGHT_CACHE_TTL_SECS: u64 = 30;

#[derive(Debug, thiserror::Error)]
pub enum MeteredLlmError {
    #[error("Insufficient credits")]
    InsufficientCredits,

    #[error("LLM error: {0}")]
    Llm(#[from] aura_claude::ClaudeClientError),

    #[error("Billing error: {0}")]
    Billing(#[from] crate::error::BillingError),
}

impl MeteredLlmError {
    pub fn is_insufficient_credits(&self) -> bool {
        matches!(self, MeteredLlmError::InsufficientCredits)
    }

    /// Returns true for any billing-related failure (insufficient credits,
    /// server errors, deserialization, network issues). Use this to decide
    /// whether to stop the automation loop — we must not keep running LLM
    /// calls if we can't record the billing for them.
    pub fn is_billing_error(&self) -> bool {
        matches!(self, MeteredLlmError::InsufficientCredits | MeteredLlmError::Billing(_))
    }
}

pub struct MeteredLlm {
    pub(crate) provider: Arc<dyn aura_claude::LlmProvider>,
    pub(crate) billing: Arc<BillingClient>,
    pub(crate) store: Arc<RocksStore>,
    pub(crate) pricing: PricingService,
    pub(crate) credits_exhausted: AtomicBool,
    pub(crate) last_preflight_ok: Mutex<Option<Instant>>,
    pub(crate) credits_per_usd: f64,
}

const DEFAULT_CREDITS_PER_USD: f64 = 114_286.0;

impl MeteredLlm {
    pub fn new(
        provider: Arc<dyn aura_claude::LlmProvider>,
        billing: Arc<BillingClient>,
        store: Arc<RocksStore>,
    ) -> Self {
        let credits_per_usd: f64 = std::env::var("BILLING_CREDITS_PER_USD")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_CREDITS_PER_USD);
        let pricing = PricingService::new(store.clone());
        Self {
            provider,
            billing,
            store,
            pricing,
            credits_exhausted: AtomicBool::new(false),
            last_preflight_ok: Mutex::new(None),
            credits_per_usd,
        }
    }

    pub fn is_credits_exhausted(&self) -> bool {
        self.credits_exhausted.load(Ordering::SeqCst)
    }

    /// Estimate how many credits a call would cost given the estimated token
    /// counts. Applies a conservative cache discount (assumes 50% of input
    /// tokens are cache reads at 0.1x cost) to avoid stopping the tool loop
    /// prematurely when prompt caching is active.
    pub fn estimate_credits(&self, model: &str, estimated_input_tokens: u64, estimated_output_tokens: u64) -> u64 {
        let (inp_rate, out_rate) = self.pricing.lookup_rate(model);
        let cache_read_fraction = 0.5;
        let non_cached = estimated_input_tokens as f64 * (1.0 - cache_read_fraction);
        let cached = estimated_input_tokens as f64 * cache_read_fraction;
        let usd_cost = (non_cached * inp_rate + cached * inp_rate * 0.1
            + estimated_output_tokens as f64 * out_rate) / 1_000_000.0;
        (usd_cost * self.credits_per_usd).round() as u64
    }

    pub async fn current_balance(&self) -> Option<u64> {
        let token = self.access_token()?;
        self.billing.get_balance(&token).await.ok().map(|b| b.total_credits)
    }

    pub(crate) fn access_token(&self) -> Option<String> {
        self.store
            .get_setting("zero_auth_session")
            .ok()
            .and_then(|bytes| serde_json::from_slice::<ZeroAuthSession>(&bytes).ok())
            .map(|s| s.access_token)
    }

    // -----------------------------------------------------------------------
    // Public API: metered LLM calls with custom billing reason + metadata
    // -----------------------------------------------------------------------

    pub async fn complete(
        &self,
        api_key: &str,
        system_prompt: &str,
        user_message: &str,
        max_tokens: u32,
        reason: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<LlmResponse, MeteredLlmError> {
        self.pre_flight_check().await?;
        let resp = self.provider.complete(api_key, system_prompt, user_message, max_tokens).await?;
        self.debit(aura_claude::DEFAULT_MODEL, resp.input_tokens, resp.output_tokens, 0, 0, reason, metadata).await?;
        Ok(resp)
    }

    pub async fn complete_with_model(
        &self,
        model: &str,
        api_key: &str,
        system_prompt: &str,
        user_message: &str,
        max_tokens: u32,
        reason: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<LlmResponse, MeteredLlmError> {
        self.pre_flight_check().await?;
        let resp = self.provider.complete_with_model(model, api_key, system_prompt, user_message, max_tokens).await?;
        self.debit(model, resp.input_tokens, resp.output_tokens, 0, 0, reason, metadata).await?;
        Ok(resp)
    }

    pub async fn complete_stream(
        &self,
        api_key: &str,
        system_prompt: &str,
        user_message: &str,
        max_tokens: u32,
        event_tx: mpsc::UnboundedSender<ClaudeStreamEvent>,
        reason: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<String, MeteredLlmError> {
        self.pre_flight_check().await?;
        let (tx, handle) = StreamTokenCapture::forwarding(event_tx);
        let result = self.provider.complete_stream(
            api_key, system_prompt, user_message, max_tokens, tx,
        ).await?;
        let (inp, out, cache_create, cache_read) = handle.finalize().await;
        self.debit(aura_claude::DEFAULT_MODEL, inp, out, cache_create, cache_read, reason, metadata).await?;
        Ok(result)
    }

    pub async fn complete_stream_multi(
        &self,
        api_key: &str,
        system_prompt: &str,
        messages: Vec<(String, String)>,
        max_tokens: u32,
        event_tx: mpsc::UnboundedSender<ClaudeStreamEvent>,
        reason: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<String, MeteredLlmError> {
        self.pre_flight_check().await?;
        let (tx, handle) = StreamTokenCapture::forwarding(event_tx);
        let result = self.provider.complete_stream_multi(
            api_key, system_prompt, messages, max_tokens, tx,
        ).await?;
        let (inp, out, cache_create, cache_read) = handle.finalize().await;
        self.debit(aura_claude::DEFAULT_MODEL, inp, out, cache_create, cache_read, reason, metadata).await?;
        Ok(result)
    }

    pub async fn complete_stream_with_tools(
        &self,
        api_key: &str,
        system_prompt: &str,
        messages: Vec<RichMessage>,
        tools: Vec<ToolDefinition>,
        max_tokens: u32,
        thinking: Option<ThinkingConfig>,
        event_tx: mpsc::UnboundedSender<ClaudeStreamEvent>,
        reason: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<ToolStreamResponse, MeteredLlmError> {
        self.complete_stream_with_tools_opt_model(
            None, api_key, system_prompt, messages, tools, max_tokens,
            thinking, event_tx, reason, metadata,
        ).await
    }

    pub async fn complete_stream_with_tools_opt_model(
        &self,
        model_override: Option<&str>,
        api_key: &str,
        system_prompt: &str,
        messages: Vec<RichMessage>,
        tools: Vec<ToolDefinition>,
        max_tokens: u32,
        thinking: Option<ThinkingConfig>,
        event_tx: mpsc::UnboundedSender<ClaudeStreamEvent>,
        reason: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<ToolStreamResponse, MeteredLlmError> {
        let estimated_input: u64 = aura_claude::estimate_tokens(system_prompt)
            + messages.iter().map(aura_claude::estimate_message_tokens).sum::<u64>();
        let estimated_credits = self.estimate_credits(aura_claude::DEFAULT_MODEL, estimated_input, 0);
        self.pre_flight_check_for(estimated_credits).await?;
        let resp = if let Some(model) = model_override {
            self.provider.complete_stream_with_tools_model(
                model, api_key, system_prompt, messages, tools, max_tokens, thinking, event_tx,
            ).await?
        } else {
            self.provider.complete_stream_with_tools(
                api_key, system_prompt, messages, tools, max_tokens, thinking, event_tx,
            ).await?
        };
        let billing_model = if resp.model_used.is_empty() { aura_claude::DEFAULT_MODEL } else { &resp.model_used };
        self.debit(billing_model, resp.input_tokens, resp.output_tokens, resp.cache_creation_input_tokens, resp.cache_read_input_tokens, reason, metadata).await?;
        Ok(resp)
    }
}
