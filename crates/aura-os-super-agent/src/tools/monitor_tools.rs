use async_trait::async_trait;
use serde_json::json;

use aura_os_core::ToolDomain;

use super::{SuperAgentContext, SuperAgentTool, ToolResult};
use crate::SuperAgentError;

fn tool_err(action: &str, e: impl std::fmt::Display) -> SuperAgentError {
    SuperAgentError::ToolError(format!("{action}: {e}"))
}

// ---------------------------------------------------------------------------
// 1. GetFleetStatusTool
// ---------------------------------------------------------------------------

pub struct GetFleetStatusTool;

#[async_trait]
impl SuperAgentTool for GetFleetStatusTool {
    fn name(&self) -> &str { "get_fleet_status" }
    fn description(&self) -> &str { "Get an overview of all agents and their current status" }
    fn domain(&self) -> ToolDomain { ToolDomain::Monitoring }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }

    async fn execute(&self, _input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = ctx
            .network_client
            .as_ref()
            .ok_or_else(|| SuperAgentError::Internal("network client not available".into()))?;

        let agents = network
            .list_agents_by_org(&ctx.org_id, &ctx.jwt)
            .await
            .map_err(|e| tool_err("get_fleet_status", e))?;

        let summary: Vec<serde_json::Value> = agents
            .iter()
            .map(|a| {
                json!({
                    "id": a.id,
                    "name": a.name,
                    "role": a.role,
                })
            })
            .collect();

        Ok(ToolResult {
            content: json!({
                "total_agents": agents.len(),
                "agents": summary
            }),
            is_error: false,
        })
    }
}

// ---------------------------------------------------------------------------
// 2. GetProgressReportTool
// ---------------------------------------------------------------------------

pub struct GetProgressReportTool;

#[async_trait]
impl SuperAgentTool for GetProgressReportTool {
    fn name(&self) -> &str { "get_progress_report" }
    fn description(&self) -> &str { "Get a progress summary across all projects and tasks" }
    fn domain(&self) -> ToolDomain { ToolDomain::Monitoring }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }

    async fn execute(&self, _input: serde_json::Value, ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let network = ctx
            .network_client
            .as_ref()
            .ok_or_else(|| SuperAgentError::Internal("network client not available".into()))?;

        let projects = network
            .list_projects_by_org(&ctx.org_id, &ctx.jwt)
            .await
            .map_err(|e| tool_err("get_progress_report", e))?;

        let project_summaries: Vec<serde_json::Value> = projects
            .iter()
            .map(|p| {
                json!({
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                })
            })
            .collect();

        Ok(ToolResult {
            content: json!({
                "total_projects": projects.len(),
                "projects": project_summaries
            }),
            is_error: false,
        })
    }
}

// ---------------------------------------------------------------------------
// 3. GetProjectCostTool
// ---------------------------------------------------------------------------

pub struct GetProjectCostTool;

#[async_trait]
impl SuperAgentTool for GetProjectCostTool {
    fn name(&self) -> &str { "get_project_cost" }
    fn description(&self) -> &str { "Get token usage and cost information for a project" }
    fn domain(&self) -> ToolDomain { ToolDomain::Monitoring }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "project_id": { "type": "string", "description": "Project ID" }
            },
            "required": ["project_id"]
        })
    }

    async fn execute(&self, input: serde_json::Value, _ctx: &SuperAgentContext) -> Result<ToolResult, SuperAgentError> {
        let project_id = input["project_id"]
            .as_str()
            .ok_or_else(|| SuperAgentError::ToolError("project_id is required".into()))?;

        Ok(ToolResult {
            content: json!({
                "project_id": project_id,
                "message": "Per-project cost tracking is not yet available. Use get_credit_balance for organization-level credit info."
            }),
            is_error: false,
        })
    }
}
