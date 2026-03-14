use aura_core::*;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct FileOpSummary {
    pub op: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PhaseTimingEntry {
    pub phase: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineEvent {
    LoopStarted {
        project_id: ProjectId,
        agent_id: AgentId,
    },
    TaskStarted {
        task_id: TaskId,
        task_title: String,
        session_id: SessionId,
        #[serde(skip_serializing_if = "Option::is_none")]
        prompt_tokens_estimate: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        codebase_snapshot_bytes: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        codebase_file_count: Option<u32>,
    },
    TaskCompleted {
        task_id: TaskId,
        execution_notes: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        input_tokens: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_tokens: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        llm_duration_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        build_verify_duration_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        files_changed_count: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        parse_retries: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        build_fix_attempts: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
    },
    TaskFailed {
        task_id: TaskId,
        reason: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        phase: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        parse_retries: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        build_fix_attempts: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
    },
    TaskRetrying {
        task_id: TaskId,
        attempt: u32,
        reason: String,
    },
    TaskBecameReady {
        task_id: TaskId,
    },
    FollowUpTaskCreated {
        task_id: TaskId,
    },
    SessionRolledOver {
        old_session_id: SessionId,
        new_session_id: SessionId,
        #[serde(skip_serializing_if = "Option::is_none")]
        summary_duration_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        context_usage_pct: Option<f64>,
    },
    LoopPaused {
        completed_count: usize,
    },
    LoopStopped {
        completed_count: usize,
    },
    LoopFinished {
        outcome: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        total_duration_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tasks_completed: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tasks_failed: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tasks_retried: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        total_input_tokens: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        total_output_tokens: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        sessions_used: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        total_parse_retries: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        total_build_fix_attempts: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        duplicate_error_bailouts: Option<u32>,
    },
    LoopIterationSummary {
        task_id: TaskId,
        phase_timings: Vec<PhaseTimingEntry>,
    },
    TaskOutputDelta {
        task_id: TaskId,
        delta: String,
    },
    FileOpsApplied {
        task_id: TaskId,
        files_written: usize,
        files_deleted: usize,
        files: Vec<FileOpSummary>,
    },
    LogLine {
        message: String,
    },

    SpecGenStarted {
        project_id: ProjectId,
    },
    SpecGenProgress {
        project_id: ProjectId,
        stage: String,
    },
    SpecGenCompleted {
        project_id: ProjectId,
        spec_count: usize,
    },
    SpecGenFailed {
        project_id: ProjectId,
        reason: String,
    },
    SpecSaved {
        project_id: ProjectId,
        spec: Spec,
    },

    BuildVerificationStarted {
        task_id: TaskId,
        command: String,
    },
    BuildVerificationPassed {
        task_id: TaskId,
        command: String,
        stdout: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },
    BuildVerificationFailed {
        task_id: TaskId,
        command: String,
        stdout: String,
        stderr: String,
        attempt: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error_hash: Option<String>,
    },
    BuildFixAttempt {
        task_id: TaskId,
        attempt: u32,
    },

    TestVerificationStarted {
        task_id: TaskId,
        command: String,
    },
    TestVerificationPassed {
        task_id: TaskId,
        command: String,
        stdout: String,
        tests: Vec<IndividualTestResult>,
        summary: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },
    TestVerificationFailed {
        task_id: TaskId,
        command: String,
        stdout: String,
        stderr: String,
        attempt: u32,
        tests: Vec<IndividualTestResult>,
        summary: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },
    TestFixAttempt {
        task_id: TaskId,
        attempt: u32,
    },
}
