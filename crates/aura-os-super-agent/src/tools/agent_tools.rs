use async_trait::async_trait;
use serde_json::json;

use aura_os_core::ToolDomain;

use super::{SuperAgentContext, SuperAgentTool, ToolResult};
use crate::SuperAgentError;

fn require_network(ctx: &SuperAgentContext) -> Result<&aura_os_network::NetworkClient, SuperAgentError> {
    ctx.network_client
        .as_deref()
        .ok_or_else(|| SuperAgentError::Internal("network client not available".into()))
}

fn tool_err(action: &str, e: impl std::fmt::Display) -> SuperAgentError {
    SuperAgentError::ToolError(format!("{action}: {e}"))
}

// ---------------------------------------------------------------------------
// 1. ListAgentsTool
// ---------------------------------------------------------------------------

pub struct ListAgentsTool;

#[async_trait]
impl SuperAgentTool for ListAgentsTool {
    fn name(&self) -> &str { "list_agents" }
    fn description(&self) -> &str { "List all agents in the organization" }
    fn domain(&self) -> ToolDomain { ToolDomain::Agent }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }

    async fn execute(&self, _input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = require_network(ctx)?;
        let agents = network
            .list_agents_by_org(&ctx.org_id, &ctx.jwt)
            .await
            .map_err(|e| tool_err("list_agents", e))?;
        Ok(ToolResult {
            content: serde_json::to_value(&agents).unwrap_or_default(),
            is_error: false,
        })
    }
}

// ---------------------------------------------------------------------------
// 2. GetAgentTool
// ---------------------------------------------------------------------------

pub struct GetAgentTool;

#[async_trait]
impl SuperAgentTool for GetAgentTool {
    fn name(&self) -> &str { "get_agent" }
    fn description(&self) -> &str { "Get details of a specific agent" }
    fn domain(&self) -> ToolDomain { ToolDomain::Agent }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "agent_id": { "type": "string", "description": "Agent ID" }
            },
            "required": ["agent_id"]
        })
    }

    async fn execute(&self, input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = require_network(ctx)?;
        let agent_id = input["agent_id"]
            .as_str()
            .ok_or_else(|| SuperAgentError::ToolError("agent_id is required".into()))?;
        let agent = network
            .get_agent(agent_id, &ctx.jwt)
            .await
            .map_err(|e| tool_err("get_agent", e))?;
        Ok(ToolResult {
            content: serde_json::to_value(&agent).unwrap_or_default(),
            is_error: false,
        })
    }
}

// ---------------------------------------------------------------------------
// 3. AssignAgentToProjectTool
// ---------------------------------------------------------------------------

pub struct AssignAgentToProjectTool;

#[async_trait]
impl SuperAgentTool for AssignAgentToProjectTool {
    fn name(&self) -> &str { "assign_agent_to_project" }
    fn description(&self) -> &str { "Create an agent instance in a project from an agent template" }
    fn domain(&self) -> ToolDomain { ToolDomain::Agent }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "project_id": { "type": "string", "description": "Target project ID" },
                "agent_id": { "type": "string", "description": "Agent template ID to assign" }
            },
            "required": ["project_id", "agent_id"]
        })
    }

    async fn execute(&self, input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = require_network(ctx)?;
        let project_id = input["project_id"]
            .as_str()
            .ok_or_else(|| SuperAgentError::ToolError("project_id is required".into()))?;
        let agent_id = input["agent_id"]
            .as_str()
            .ok_or_else(|| SuperAgentError::ToolError("agent_id is required".into()))?;

        let body = json!({ "agent_id": agent_id });
        let url = format!("{}/api/projects/{}/agents", network.base_url(), project_id);
        let resp = network
            .http_client()
            .post(&url)
            .bearer_auth(&ctx.jwt)
            .json(&body)
            .send()
            .await
            .map_err(|e| tool_err("assign_agent_to_project", e))?;

        let status = resp.status();
        let body_text = resp
            .text()
            .await
            .map_err(|e| tool_err("assign_agent_to_project", e))?;

        if !status.is_success() {
            return Ok(ToolResult {
                content: json!({ "error": body_text, "status": status.as_u16() }),
                is_error: true,
            });
        }

        let result: serde_json::Value = serde_json::from_str(&body_text)
            .unwrap_or_else(|_| json!({ "message": "Agent assigned successfully" }));
        Ok(ToolResult {
            content: result,
            is_error: false,
        })
    }
}
