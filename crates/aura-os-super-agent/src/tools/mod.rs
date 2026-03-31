pub mod agent_tools;
pub mod billing_tools;
pub mod exec_tools;
pub mod monitor_tools;
pub mod project_tools;

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use aura_os_agents::{AgentInstanceService, AgentService};
use aura_os_billing::BillingClient;
use aura_os_core::ToolDomain;
use aura_os_link::AutomatonClient;
use aura_os_network::NetworkClient;
use aura_os_orgs::OrgService;
use aura_os_projects::ProjectService;
use aura_os_sessions::SessionService;
use aura_os_storage::StorageClient;
use aura_os_store::RocksStore;
use aura_os_tasks::TaskService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub content: serde_json::Value,
    #[serde(default)]
    pub is_error: bool,
}

#[async_trait]
pub trait SuperAgentTool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn domain(&self) -> ToolDomain;
    fn parameters_schema(&self) -> serde_json::Value;
    async fn execute(
        &self,
        input: serde_json::Value,
        ctx: &SuperAgentContext,
    ) -> Result<ToolResult, crate::SuperAgentError>;
}

pub struct SuperAgentContext {
    pub user_id: String,
    pub org_id: String,
    pub jwt: String,
    pub project_service: Arc<ProjectService>,
    pub agent_service: Arc<AgentService>,
    pub agent_instance_service: Arc<AgentInstanceService>,
    pub task_service: Arc<TaskService>,
    pub session_service: Arc<SessionService>,
    pub org_service: Arc<OrgService>,
    pub billing_client: Arc<BillingClient>,
    pub automaton_client: Arc<AutomatonClient>,
    pub network_client: Option<Arc<NetworkClient>>,
    pub storage_client: Option<Arc<StorageClient>>,
    pub store: Arc<RocksStore>,
    pub event_broadcast: broadcast::Sender<serde_json::Value>,
}

pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn SuperAgentTool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    pub fn with_tier1_tools() -> Self {
        let mut registry = Self::new();

        // Project tools
        registry.register(Arc::new(project_tools::CreateProjectTool));
        registry.register(Arc::new(project_tools::ImportProjectTool));
        registry.register(Arc::new(project_tools::ListProjectsTool));
        registry.register(Arc::new(project_tools::GetProjectTool));
        registry.register(Arc::new(project_tools::UpdateProjectTool));
        registry.register(Arc::new(project_tools::DeleteProjectTool));
        registry.register(Arc::new(project_tools::ArchiveProjectTool));
        registry.register(Arc::new(project_tools::GetProjectStatsTool));

        // Agent tools
        registry.register(Arc::new(agent_tools::ListAgentsTool));
        registry.register(Arc::new(agent_tools::GetAgentTool));
        registry.register(Arc::new(agent_tools::AssignAgentToProjectTool));

        // Execution tools
        registry.register(Arc::new(exec_tools::StartDevLoopTool));
        registry.register(Arc::new(exec_tools::PauseDevLoopTool));
        registry.register(Arc::new(exec_tools::StopDevLoopTool));
        registry.register(Arc::new(exec_tools::GetLoopStatusTool));
        registry.register(Arc::new(exec_tools::SendToAgentTool));

        // Monitoring tools
        registry.register(Arc::new(monitor_tools::GetFleetStatusTool));
        registry.register(Arc::new(monitor_tools::GetProgressReportTool));
        registry.register(Arc::new(monitor_tools::GetProjectCostTool));

        // Billing tools
        registry.register(Arc::new(billing_tools::GetCreditBalanceTool));

        registry
    }

    pub fn register(&mut self, tool: Arc<dyn SuperAgentTool>) {
        self.tools.insert(tool.name().to_string(), tool);
    }

    pub fn get(&self, name: &str) -> Option<&Arc<dyn SuperAgentTool>> {
        self.tools.get(name)
    }

    pub fn list_tools(&self) -> Vec<&Arc<dyn SuperAgentTool>> {
        self.tools.values().collect()
    }

    pub fn tools_for_domains(&self, domains: &[ToolDomain]) -> Vec<&Arc<dyn SuperAgentTool>> {
        self.tools
            .values()
            .filter(|t| domains.contains(&t.domain()))
            .collect()
    }

    pub fn tool_definitions(&self, tools: &[&Arc<dyn SuperAgentTool>]) -> Vec<serde_json::Value> {
        tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "name": t.name(),
                    "description": t.description(),
                    "input_schema": t.parameters_schema(),
                })
            })
            .collect()
    }
}
