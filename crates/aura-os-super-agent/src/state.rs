use aura_os_core::SuperAgentOrchestration;
use uuid::Uuid;

pub struct OrchestrationStore {
    orchestrations: Vec<SuperAgentOrchestration>,
}

impl OrchestrationStore {
    pub fn new() -> Self {
        Self {
            orchestrations: Vec::new(),
        }
    }

    pub fn save(&mut self, orchestration: SuperAgentOrchestration) {
        if let Some(pos) = self
            .orchestrations
            .iter()
            .position(|o| o.orchestration_id == orchestration.orchestration_id)
        {
            self.orchestrations[pos] = orchestration;
        } else {
            self.orchestrations.push(orchestration);
        }
    }

    pub fn get(&self, id: &Uuid) -> Option<&SuperAgentOrchestration> {
        self.orchestrations
            .iter()
            .find(|o| &o.orchestration_id == id)
    }

    pub fn list(&self) -> &[SuperAgentOrchestration] {
        &self.orchestrations
    }
}
