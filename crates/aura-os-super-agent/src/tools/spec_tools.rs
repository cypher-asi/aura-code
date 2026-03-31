use async_trait::async_trait;
use serde_json::json;

use aura_os_core::ToolDomain;

use super::helpers::{network_get, network_post, require_network, require_str};
use super::{SuperAgentContext, SuperAgentTool, ToolResult};
use crate::SuperAgentError;

// ---------------------------------------------------------------------------
// 1. ListSpecsTool
// ---------------------------------------------------------------------------

pub struct ListSpecsTool;

#[async_trait]
impl SuperAgentTool for ListSpecsTool {
    fn name(&self) -> &str { "list_specs" }
    fn description(&self) -> &str { "List all specifications for a project" }
    fn domain(&self) -> ToolDomain { ToolDomain::Spec }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "project_id": { "type": "string", "description": "Project ID" }
            },
            "required": ["project_id"]
        })
    }

    async fn execute(&self, input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = require_network(ctx)?;
        let project_id = require_str(&input, "project_id")?;
        network_get(network, &format!("/api/projects/{project_id}/specs"), &ctx.jwt).await
    }
}

// ---------------------------------------------------------------------------
// 2. GetSpecTool
// ---------------------------------------------------------------------------

pub struct GetSpecTool;

#[async_trait]
impl SuperAgentTool for GetSpecTool {
    fn name(&self) -> &str { "get_spec" }
    fn description(&self) -> &str { "Get details of a specific specification" }
    fn domain(&self) -> ToolDomain { ToolDomain::Spec }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "project_id": { "type": "string", "description": "Project ID" },
                "spec_id": { "type": "string", "description": "Specification ID" }
            },
            "required": ["project_id", "spec_id"]
        })
    }

    async fn execute(&self, input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = require_network(ctx)?;
        let project_id = require_str(&input, "project_id")?;
        let spec_id = require_str(&input, "spec_id")?;
        network_get(network, &format!("/api/projects/{project_id}/specs/{spec_id}"), &ctx.jwt).await
    }
}

// ---------------------------------------------------------------------------
// 3. GenerateSpecsTool
// ---------------------------------------------------------------------------

pub struct GenerateSpecsTool;

#[async_trait]
impl SuperAgentTool for GenerateSpecsTool {
    fn name(&self) -> &str { "generate_specs" }
    fn description(&self) -> &str { "Auto-generate specifications for a project from its codebase" }
    fn domain(&self) -> ToolDomain { ToolDomain::Spec }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "project_id": { "type": "string", "description": "Project ID" }
            },
            "required": ["project_id"]
        })
    }

    async fn execute(&self, input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = require_network(ctx)?;
        let project_id = require_str(&input, "project_id")?;
        network_post(network, &format!("/api/projects/{project_id}/specs/generate"), &ctx.jwt, &json!({})).await
    }
}

// ---------------------------------------------------------------------------
// 4. GenerateSpecsSummaryTool
// ---------------------------------------------------------------------------

pub struct GenerateSpecsSummaryTool;

#[async_trait]
impl SuperAgentTool for GenerateSpecsSummaryTool {
    fn name(&self) -> &str { "generate_specs_summary" }
    fn description(&self) -> &str { "Generate a summary of all specifications for a project" }
    fn domain(&self) -> ToolDomain { ToolDomain::Spec }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "project_id": { "type": "string", "description": "Project ID" }
            },
            "required": ["project_id"]
        })
    }

    async fn execute(&self, input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = require_network(ctx)?;
        let project_id = require_str(&input, "project_id")?;
        network_post(network, &format!("/api/projects/{project_id}/specs/summary"), &ctx.jwt, &json!({})).await
    }
}
