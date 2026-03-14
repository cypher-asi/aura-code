use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{broadcast, mpsc, Mutex};

use aura_core::TaskId;
use aura_engine::{EngineEvent, LoopHandle};
use aura_terminal::TerminalManager;
use aura_services::{
    AgentService, AuthService, ChatService, ClaudeClient, GitHubService, OrgService,
    PricingService, ProjectService, SessionService, SpecGenerationService,
    TaskExtractionService, TaskService,
};
use aura_settings::SettingsService;
use aura_store::RocksStore;

pub type TaskOutputBuffers = Arc<std::sync::Mutex<HashMap<TaskId, String>>>;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<RocksStore>,
    pub org_service: Arc<OrgService>,
    pub github_service: Arc<GitHubService>,
    pub auth_service: Arc<AuthService>,
    pub settings_service: Arc<SettingsService>,
    pub pricing_service: Arc<PricingService>,
    pub project_service: Arc<ProjectService>,
    pub spec_gen_service: Arc<SpecGenerationService>,
    pub task_extraction_service: Arc<TaskExtractionService>,
    pub task_service: Arc<TaskService>,
    pub agent_service: Arc<AgentService>,
    pub session_service: Arc<SessionService>,
    pub chat_service: Arc<ChatService>,
    pub claude_client: Arc<ClaudeClient>,
    pub event_tx: mpsc::UnboundedSender<EngineEvent>,
    pub event_broadcast: broadcast::Sender<EngineEvent>,
    pub loop_handle: Arc<Mutex<Option<LoopHandle>>>,
    pub loop_project_id: Arc<Mutex<Option<aura_core::ProjectId>>>,
    pub task_output_buffers: TaskOutputBuffers,
    pub terminal_manager: Arc<TerminalManager>,
}
