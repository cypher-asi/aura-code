mod error;
pub use error::AgentError;

use std::sync::Arc;

use chrono::{DateTime, Utc};

use aura_core::*;
use aura_storage::StorageClient;
use aura_store::RocksStore;

// ---------------------------------------------------------------------------
// AgentService – user-level agent templates (local shadow store)
// ---------------------------------------------------------------------------

pub struct AgentService {
    store: Arc<RocksStore>,
}

impl AgentService {
    pub fn new(store: Arc<RocksStore>) -> Self {
        Self { store }
    }

    pub fn get_agent(&self, user_id: &str, agent_id: &AgentId) -> Result<Agent, AgentError> {
        self.store
            .get_agent(user_id, agent_id)
            .map_err(|e| match e {
                aura_store::StoreError::NotFound(_) => AgentError::NotFound,
                other => AgentError::Store(other),
            })
    }
}

// ---------------------------------------------------------------------------
// AgentInstanceService – project-level agent instances (aura-storage)
// ---------------------------------------------------------------------------

pub struct AgentInstanceService {
    store: Arc<RocksStore>,
    storage_client: Option<Arc<StorageClient>>,
}

impl AgentInstanceService {
    pub fn new(store: Arc<RocksStore>, storage_client: Option<Arc<StorageClient>>) -> Self {
        Self { store, storage_client }
    }

    fn require_storage(&self) -> Result<&Arc<StorageClient>, AgentError> {
        self.storage_client
            .as_ref()
            .ok_or_else(|| AgentError::Parse("aura-storage is not configured".into()))
    }

    fn get_jwt(&self) -> Result<String, AgentError> {
        let bytes = self
            .store
            .get_setting("zero_auth_session")
            .map_err(|_| AgentError::NoSession)?;
        let session: ZeroAuthSession =
            serde_json::from_slice(&bytes).map_err(|e| AgentError::Parse(e.to_string()))?;
        Ok(session.access_token)
    }

    pub async fn create_instance_from_agent(
        &self,
        project_id: &ProjectId,
        agent: &Agent,
    ) -> Result<AgentInstance, AgentError> {
        let storage = self.require_storage()?;
        let jwt = self.get_jwt()?;
        let req = aura_storage::CreateProjectAgentRequest {
            agent_id: agent.agent_id.to_string(),
            name: agent.name.clone(),
            role: Some(agent.role.clone()),
            personality: Some(agent.personality.clone()),
            system_prompt: Some(agent.system_prompt.clone()),
            skills: Some(agent.skills.clone()),
            icon: agent.icon.clone(),
        };
        let spa = storage
            .create_project_agent(&project_id.to_string(), &jwt, &req)
            .await?;
        Ok(storage_project_agent_to_instance(&spa))
    }

    pub async fn get_instance(
        &self,
        _project_id: &ProjectId,
        agent_instance_id: &AgentInstanceId,
    ) -> Result<AgentInstance, AgentError> {
        let storage = self.require_storage()?;
        let jwt = self.get_jwt()?;
        let spa = storage
            .get_project_agent(&agent_instance_id.to_string(), &jwt)
            .await
            .map_err(|e| match &e {
                aura_storage::StorageError::Server { status: 404, .. } => AgentError::NotFound,
                _ => AgentError::Storage(e),
            })?;
        Ok(storage_project_agent_to_instance(&spa))
    }

    pub async fn list_instances(
        &self,
        project_id: &ProjectId,
    ) -> Result<Vec<AgentInstance>, AgentError> {
        let storage = self.require_storage()?;
        let jwt = self.get_jwt()?;
        let spas = storage
            .list_project_agents(&project_id.to_string(), &jwt)
            .await?;
        Ok(spas.iter().map(storage_project_agent_to_instance).collect())
    }

    pub async fn update_status(
        &self,
        agent_instance_id: &AgentInstanceId,
        new_status: AgentStatus,
    ) -> Result<(), AgentError> {
        let storage = self.require_storage()?;
        let jwt = self.get_jwt()?;
        let status_str = match new_status {
            AgentStatus::Idle => "idle",
            AgentStatus::Working => "working",
            AgentStatus::Blocked => "blocked",
            AgentStatus::Stopped => "stopped",
            AgentStatus::Error => "error",
        };
        let req = aura_storage::UpdateProjectAgentRequest {
            status: status_str.to_string(),
        };
        storage
            .update_project_agent_status(&agent_instance_id.to_string(), &jwt, &req)
            .await?;
        Ok(())
    }

    pub async fn delete_instance(
        &self,
        agent_instance_id: &AgentInstanceId,
    ) -> Result<(), AgentError> {
        let storage = self.require_storage()?;
        let jwt = self.get_jwt()?;
        storage
            .delete_project_agent(&agent_instance_id.to_string(), &jwt)
            .await
            .map_err(|e| match &e {
                aura_storage::StorageError::Server { status: 404, .. } => AgentError::NotFound,
                _ => AgentError::Storage(e),
            })?;
        Ok(())
    }

    pub async fn start_working(
        &self,
        _project_id: &ProjectId,
        agent_instance_id: &AgentInstanceId,
        _task_id: &TaskId,
        _session_id: &SessionId,
    ) -> Result<(), AgentError> {
        self.update_status(agent_instance_id, AgentStatus::Working).await
    }

    pub async fn finish_working(
        &self,
        _project_id: &ProjectId,
        agent_instance_id: &AgentInstanceId,
    ) -> Result<(), AgentError> {
        self.update_status(agent_instance_id, AgentStatus::Idle).await
    }

    pub fn validate_transition(
        current: AgentStatus,
        target: AgentStatus,
    ) -> Result<(), AgentError> {
        let legal = matches!(
            (current, target),
            (AgentStatus::Idle, AgentStatus::Working)
                | (AgentStatus::Working, AgentStatus::Idle)
                | (AgentStatus::Working, AgentStatus::Blocked)
                | (AgentStatus::Working, AgentStatus::Error)
                | (AgentStatus::Working, AgentStatus::Stopped)
                | (AgentStatus::Blocked, AgentStatus::Working)
                | (AgentStatus::Idle, AgentStatus::Stopped)
                | (AgentStatus::Stopped, AgentStatus::Idle)
                | (AgentStatus::Error, AgentStatus::Idle)
        );
        if legal {
            Ok(())
        } else {
            Err(AgentError::IllegalTransition { current, target })
        }
    }
}

// ---------------------------------------------------------------------------
// StorageProjectAgent -> AgentInstance conversion
// ---------------------------------------------------------------------------

fn parse_dt(s: &Option<String>) -> DateTime<Utc> {
    s.as_deref()
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(Utc::now)
}

fn parse_agent_status(s: &str) -> AgentStatus {
    match s {
        "idle" => AgentStatus::Idle,
        "working" => AgentStatus::Working,
        "blocked" => AgentStatus::Blocked,
        "stopped" => AgentStatus::Stopped,
        "error" => AgentStatus::Error,
        _ => AgentStatus::Idle,
    }
}

fn storage_project_agent_to_instance(spa: &aura_storage::StorageProjectAgent) -> AgentInstance {
    AgentInstance {
        agent_instance_id: spa.id.parse().unwrap_or_else(|_| AgentInstanceId::new()),
        project_id: spa
            .project_id
            .as_deref()
            .unwrap_or("")
            .parse()
            .unwrap_or_else(|_| ProjectId::new()),
        agent_id: spa
            .agent_id
            .as_deref()
            .unwrap_or("")
            .parse()
            .unwrap_or_else(|_| AgentId::new()),
        name: spa.name.clone().unwrap_or_default(),
        role: spa.role.clone().unwrap_or_default(),
        personality: spa.personality.clone().unwrap_or_default(),
        system_prompt: spa.system_prompt.clone().unwrap_or_default(),
        skills: spa.skills.clone().unwrap_or_default(),
        icon: spa.icon.clone(),
        status: spa
            .status
            .as_deref()
            .map(parse_agent_status)
            .unwrap_or(AgentStatus::Idle),
        current_task_id: None,
        current_session_id: None,
        total_input_tokens: spa.total_input_tokens.unwrap_or(0),
        total_output_tokens: spa.total_output_tokens.unwrap_or(0),
        model: spa.model.clone(),
        created_at: parse_dt(&spa.created_at),
        updated_at: parse_dt(&spa.updated_at),
    }
}
