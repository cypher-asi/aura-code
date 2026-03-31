use async_trait::async_trait;
use serde_json::json;

use aura_os_core::ToolDomain;

use super::{SuperAgentContext, SuperAgentTool, ToolResult};
use crate::SuperAgentError;

// ---------------------------------------------------------------------------
// 1. GetCreditBalanceTool
// ---------------------------------------------------------------------------

pub struct GetCreditBalanceTool;

#[async_trait]
impl SuperAgentTool for GetCreditBalanceTool {
    fn name(&self) -> &str { "get_credit_balance" }
    fn description(&self) -> &str { "Get the current credit balance for the organization" }
    fn domain(&self) -> ToolDomain { ToolDomain::Billing }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "org_id": { "type": "string", "description": "Organization ID (uses context org if omitted)" }
            },
            "required": []
        })
    }

    async fn execute(&self, _input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let balance = ctx
            .billing_client
            .get_balance(&ctx.jwt)
            .await
            .map_err(|e| SuperAgentError::ToolError(format!("get_credit_balance: {e}")))?;

        Ok(ToolResult {
            content: json!({
                "balance_cents": balance.balance_cents,
                "balance_formatted": balance.balance_formatted,
                "plan": balance.plan
            }),
            is_error: false,
        })
    }
}
