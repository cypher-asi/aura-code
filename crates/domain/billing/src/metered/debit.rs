use std::sync::atomic::Ordering;

use tracing::{info, warn};

use crate::error::BillingError;
use super::{MeteredLlm, MeteredLlmError};

impl MeteredLlm {
    pub(crate) async fn debit(
        &self,
        model: &str,
        input_tokens: u64,
        output_tokens: u64,
        cache_creation_input_tokens: u64,
        cache_read_input_tokens: u64,
        reason: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<(), MeteredLlmError> {
        let (inp_rate, out_rate) = self.pricing.lookup_rate(model);
        let non_cached = input_tokens.saturating_sub(cache_creation_input_tokens + cache_read_input_tokens);
        let usd_cost = (
            non_cached as f64 * inp_rate
            + cache_creation_input_tokens as f64 * inp_rate * 1.25
            + cache_read_input_tokens as f64 * inp_rate * 0.1
            + output_tokens as f64 * out_rate
        ) / 1_000_000.0;
        let amount = (usd_cost * self.credits_per_usd).round() as u64;
        if amount == 0 {
            return Ok(());
        }
        let Some(token) = self.access_token() else {
            warn!("No access token available for credit debit");
            self.credits_exhausted.store(true, Ordering::SeqCst);
            return Err(MeteredLlmError::InsufficientCredits);
        };
        match self.billing.debit_credits(&token, amount, reason, None, metadata).await {
            Ok(resp) => {
                info!(amount, reason, balance = resp.balance, tx = %resp.transaction_id, "Credits debited");
                Ok(())
            }
            Err(BillingError::InsufficientCredits { available, required }) => {
                warn!(available, required, "Insufficient credits during debit, draining remaining");
                if available > 0 {
                    match self.billing.debit_credits(&token, available, reason, None, None).await {
                        Ok(resp) => {
                            info!(amount = available, balance = resp.balance, "Drained remaining credits");
                        }
                        Err(e) => {
                            warn!(error = %e, "Failed to drain remaining credits");
                        }
                    }
                }
                self.credits_exhausted.store(true, Ordering::SeqCst);
                Err(MeteredLlmError::InsufficientCredits)
            }
            Err(e) => {
                warn!(error = %e, reason, "Failed to debit credits — flagging exhausted to stop loop");
                self.credits_exhausted.store(true, Ordering::SeqCst);
                Err(MeteredLlmError::Billing(e))
            }
        }
    }
}
