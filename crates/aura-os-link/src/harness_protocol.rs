use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub path: String,
    #[serde(default)]
    pub git_repo_url: Option<String>,
    #[serde(default)]
    pub git_branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUsage {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesChanged {
    #[serde(default)]
    pub files: Vec<FileChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub op: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalToolDef {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub input_schema: serde_json::Value,
}

/// Messages sent TO the harness (client -> harness)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HarnessInbound {
    SessionInit {
        #[serde(default)]
        system_prompt: Option<String>,
        #[serde(default)]
        model: Option<String>,
        #[serde(default)]
        max_tokens: Option<u32>,
        #[serde(default)]
        max_turns: Option<u32>,
        #[serde(default)]
        workspace: Option<WorkspaceConfig>,
        #[serde(default)]
        token: Option<String>,
        #[serde(default)]
        external_tools: Vec<ExternalToolDef>,
    },
    UserMessage {
        content: String,
    },
    Cancel,
    ToolCallbackResponse {
        callback_id: String,
        result: serde_json::Value,
        #[serde(default)]
        is_error: bool,
    },
}

/// Messages received FROM the harness (harness -> client)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HarnessOutbound {
    SessionReady {
        session_id: String,
        #[serde(default)]
        tools: Vec<ToolDef>,
    },
    AssistantMessageStart {
        message_id: String,
    },
    TextDelta {
        text: String,
    },
    ThinkingDelta {
        thinking: String,
    },
    ToolUseStart {
        id: String,
        name: String,
    },
    ToolResult {
        name: String,
        result: String,
        #[serde(default)]
        is_error: bool,
    },
    AssistantMessageEnd {
        message_id: String,
        stop_reason: String,
        #[serde(default)]
        usage: Option<SessionUsage>,
        #[serde(default)]
        files_changed: Option<FilesChanged>,
    },
    Error {
        code: String,
        message: String,
        #[serde(default)]
        recoverable: bool,
    },
    ToolCallbackRequest {
        callback_id: String,
        tool_name: String,
        input: serde_json::Value,
    },
}
