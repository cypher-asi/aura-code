use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::OnceLock;

pub const TRUSTED_INTEGRATION_RUNTIME_METADATA_KEY: &str = "trusted_integration_runtime";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustedIntegrationMethodDefinition {
    pub name: String,
    pub provider: String,
    pub description: String,
    pub prompt_signature: String,
    pub input_schema: Value,
    pub runtime: TrustedIntegrationRuntimeSpec,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrustedIntegrationHttpMethod {
    Get,
    Post,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrustedIntegrationArgValueType {
    String,
    StringList,
    PositiveNumber,
    Json,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustedIntegrationArgBinding {
    pub arg_names: Vec<String>,
    pub target: String,
    pub value_type: TrustedIntegrationArgValueType,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<Value>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrustedIntegrationSuccessGuard {
    None,
    SlackOk,
    GraphqlErrors,
}

impl Default for TrustedIntegrationSuccessGuard {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustedIntegrationResultField {
    pub output: String,
    pub pointer: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustedIntegrationResultExtraField {
    pub output: String,
    pub pointer: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TrustedIntegrationResultTransform {
    WrapPointer {
        key: String,
        pointer: String,
    },
    ProjectArray {
        key: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pointer: Option<String>,
        fields: Vec<TrustedIntegrationResultField>,
        #[serde(default)]
        extras: Vec<TrustedIntegrationResultExtraField>,
    },
    ProjectObject {
        key: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pointer: Option<String>,
        fields: Vec<TrustedIntegrationResultField>,
    },
    BraveSearch {
        vertical: String,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TrustedIntegrationRuntimeSpec {
    RestJson {
        method: TrustedIntegrationHttpMethod,
        path: String,
        #[serde(default)]
        query: Vec<TrustedIntegrationArgBinding>,
        #[serde(default)]
        body: Vec<TrustedIntegrationArgBinding>,
        #[serde(default)]
        success_guard: TrustedIntegrationSuccessGuard,
        result: TrustedIntegrationResultTransform,
    },
    Graphql {
        query: String,
        #[serde(default)]
        variables: Vec<TrustedIntegrationArgBinding>,
        #[serde(default)]
        success_guard: TrustedIntegrationSuccessGuard,
        result: TrustedIntegrationResultTransform,
    },
    BraveSearch {
        vertical: String,
    },
    ResendSendEmail,
}

pub fn trusted_integration_methods() -> &'static [TrustedIntegrationMethodDefinition] {
    static METHODS: OnceLock<Vec<TrustedIntegrationMethodDefinition>> = OnceLock::new();
    METHODS.get_or_init(|| {
        vec![
            TrustedIntegrationMethodDefinition {
                name: "github_list_repos".to_string(),
                provider: "github".to_string(),
                description: "List GitHub repositories accessible through a saved org integration."
                    .to_string(),
                prompt_signature: "github_list_repos(integration_id?)".to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "integration_id": { "type": "string", "description": "Optional org integration id when multiple GitHub integrations exist." }
                    }
                }),
                runtime: TrustedIntegrationRuntimeSpec::RestJson {
                    method: TrustedIntegrationHttpMethod::Get,
                    path: "/user/repos?per_page=20&sort=updated".to_string(),
                    query: vec![],
                    body: vec![],
                    success_guard: TrustedIntegrationSuccessGuard::None,
                    result: TrustedIntegrationResultTransform::ProjectArray {
                        key: "repos".to_string(),
                        pointer: None,
                        fields: vec![
                            result_field("name", "/name"),
                            result_field("full_name", "/full_name"),
                            result_field("private", "/private"),
                            result_field("html_url", "/html_url"),
                            result_field("default_branch", "/default_branch"),
                            result_field("description", "/description"),
                        ],
                        extras: vec![],
                    },
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "github_create_issue".to_string(),
                provider: "github".to_string(),
                description: "Create a GitHub issue through a saved org integration.".to_string(),
                prompt_signature:
                    "github_create_issue(owner, repo, title, body?, integration_id?)".to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "integration_id": { "type": "string" },
                        "owner": { "type": "string", "description": "Repository owner or org name." },
                        "repo": { "type": "string", "description": "Repository name." },
                        "title": { "type": "string", "description": "Issue title." },
                        "body": { "type": "string", "description": "Optional markdown issue body." }
                    },
                    "required": ["owner", "repo", "title"]
                }),
                runtime: TrustedIntegrationRuntimeSpec::RestJson {
                    method: TrustedIntegrationHttpMethod::Post,
                    path: "/repos/{owner}/{repo}/issues".to_string(),
                    query: vec![],
                    body: vec![
                        arg_binding(&["title"], "title", TrustedIntegrationArgValueType::String, true, None),
                        arg_binding(
                            &["body", "markdown_contents", "markdownContents"],
                            "body",
                            TrustedIntegrationArgValueType::String,
                            false,
                            None,
                        ),
                    ],
                    success_guard: TrustedIntegrationSuccessGuard::None,
                    result: TrustedIntegrationResultTransform::ProjectObject {
                        key: "issue".to_string(),
                        pointer: None,
                        fields: vec![
                            result_field("number", "/number"),
                            result_field("title", "/title"),
                            result_field("state", "/state"),
                            result_field("html_url", "/html_url"),
                        ],
                    },
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "linear_list_teams".to_string(),
                provider: "linear".to_string(),
                description: "List Linear teams available through a saved org integration."
                    .to_string(),
                prompt_signature: "linear_list_teams(integration_id?)".to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": { "integration_id": { "type": "string" } }
                }),
                runtime: TrustedIntegrationRuntimeSpec::Graphql {
                    query: "query AuraLinearTeams { teams { nodes { id name key } } }".to_string(),
                    variables: vec![],
                    success_guard: TrustedIntegrationSuccessGuard::GraphqlErrors,
                    result: TrustedIntegrationResultTransform::WrapPointer {
                        key: "teams".to_string(),
                        pointer: "/data/teams/nodes".to_string(),
                    },
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "linear_create_issue".to_string(),
                provider: "linear".to_string(),
                description: "Create a Linear issue through a saved org integration.".to_string(),
                prompt_signature:
                    "linear_create_issue(team_id, title, description?, integration_id?)"
                        .to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "integration_id": { "type": "string" },
                        "team_id": { "type": "string", "description": "Linear team id from linear_list_teams." },
                        "title": { "type": "string", "description": "Issue title." },
                        "description": { "type": "string", "description": "Optional issue description." }
                    },
                    "required": ["team_id", "title"]
                }),
                runtime: TrustedIntegrationRuntimeSpec::Graphql {
                    query: "mutation AuraLinearCreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url state { name } team { id name key } } } }".to_string(),
                    variables: vec![
                        arg_binding(&["team_id", "teamId"], "input.teamId", TrustedIntegrationArgValueType::String, true, None),
                        arg_binding(&["title"], "input.title", TrustedIntegrationArgValueType::String, true, None),
                        arg_binding(
                            &["description", "body", "markdown_contents", "markdownContents"],
                            "input.description",
                            TrustedIntegrationArgValueType::String,
                            false,
                            None,
                        ),
                    ],
                    success_guard: TrustedIntegrationSuccessGuard::GraphqlErrors,
                    result: TrustedIntegrationResultTransform::WrapPointer {
                        key: "issue".to_string(),
                        pointer: "/data/issueCreate/issue".to_string(),
                    },
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "slack_list_channels".to_string(),
                provider: "slack".to_string(),
                description: "List Slack channels available through a saved org integration."
                    .to_string(),
                prompt_signature: "slack_list_channels(integration_id?)".to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": { "integration_id": { "type": "string" } }
                }),
                runtime: TrustedIntegrationRuntimeSpec::RestJson {
                    method: TrustedIntegrationHttpMethod::Get,
                    path: "/conversations.list".to_string(),
                    query: vec![
                        static_binding("types", "public_channel,private_channel"),
                        static_binding("exclude_archived", "true"),
                        static_binding("limit", "100"),
                    ],
                    body: vec![],
                    success_guard: TrustedIntegrationSuccessGuard::SlackOk,
                    result: TrustedIntegrationResultTransform::ProjectArray {
                        key: "channels".to_string(),
                        pointer: Some("/channels".to_string()),
                        fields: vec![
                            result_field("id", "/id"),
                            result_field("name", "/name"),
                            result_field("is_private", "/is_private"),
                        ],
                        extras: vec![],
                    },
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "slack_post_message".to_string(),
                provider: "slack".to_string(),
                description: "Post a message to Slack through a saved org integration."
                    .to_string(),
                prompt_signature:
                    "slack_post_message(channel_id, text, integration_id?)".to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "integration_id": { "type": "string" },
                        "channel_id": { "type": "string", "description": "Slack channel id." },
                        "text": { "type": "string", "description": "Message text to send." }
                    },
                    "required": ["channel_id", "text"]
                }),
                runtime: TrustedIntegrationRuntimeSpec::RestJson {
                    method: TrustedIntegrationHttpMethod::Post,
                    path: "/chat.postMessage".to_string(),
                    query: vec![],
                    body: vec![
                        arg_binding(
                            &["channel_id", "channelId"],
                            "channel",
                            TrustedIntegrationArgValueType::String,
                            true,
                            None,
                        ),
                        arg_binding(
                            &["text", "message"],
                            "text",
                            TrustedIntegrationArgValueType::String,
                            true,
                            None,
                        ),
                    ],
                    success_guard: TrustedIntegrationSuccessGuard::SlackOk,
                    result: TrustedIntegrationResultTransform::ProjectObject {
                        key: "message".to_string(),
                        pointer: None,
                        fields: vec![
                            result_field("channel", "/channel"),
                            result_field("ts", "/ts"),
                        ],
                    },
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "brave_search_web".to_string(),
                provider: "brave_search".to_string(),
                description:
                    "Search the web through a saved Brave Search org integration.".to_string(),
                prompt_signature:
                    "brave_search_web(query, count?, freshness?, country?, search_lang?, integration_id?)"
                        .to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "integration_id": { "type": "string" },
                        "query": { "type": "string", "description": "Search query." },
                        "count": { "type": "integer", "description": "Maximum number of results to return." },
                        "freshness": { "type": "string", "description": "Optional freshness filter such as pd, pw, pm, or py." },
                        "country": { "type": "string", "description": "Optional 2-letter country code." },
                        "search_lang": { "type": "string", "description": "Optional search language code." }
                    },
                    "required": ["query"]
                }),
                runtime: TrustedIntegrationRuntimeSpec::BraveSearch {
                    vertical: "web".to_string(),
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "brave_search_news".to_string(),
                provider: "brave_search".to_string(),
                description:
                    "Search recent news through a saved Brave Search org integration.".to_string(),
                prompt_signature:
                    "brave_search_news(query, count?, freshness?, country?, search_lang?, integration_id?)"
                        .to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "integration_id": { "type": "string" },
                        "query": { "type": "string", "description": "News search query." },
                        "count": { "type": "integer", "description": "Maximum number of results to return." },
                        "freshness": { "type": "string", "description": "Optional freshness filter such as pd, pw, pm, or py." },
                        "country": { "type": "string", "description": "Optional 2-letter country code." },
                        "search_lang": { "type": "string", "description": "Optional search language code." }
                    },
                    "required": ["query"]
                }),
                runtime: TrustedIntegrationRuntimeSpec::BraveSearch {
                    vertical: "news".to_string(),
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "resend_list_domains".to_string(),
                provider: "resend".to_string(),
                description: "List Resend domains through a saved org integration.".to_string(),
                prompt_signature: "resend_list_domains(integration_id?)".to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": { "integration_id": { "type": "string" } }
                }),
                runtime: TrustedIntegrationRuntimeSpec::RestJson {
                    method: TrustedIntegrationHttpMethod::Get,
                    path: "/domains".to_string(),
                    query: vec![],
                    body: vec![],
                    success_guard: TrustedIntegrationSuccessGuard::None,
                    result: TrustedIntegrationResultTransform::ProjectArray {
                        key: "domains".to_string(),
                        pointer: Some("/data".to_string()),
                        fields: vec![
                            result_field("id", "/id"),
                            result_field("name", "/name"),
                            result_field("status", "/status"),
                            result_field("created_at", "/created_at"),
                            result_field("region", "/region"),
                            result_field("capabilities", "/capabilities"),
                        ],
                        extras: vec![TrustedIntegrationResultExtraField {
                            output: "has_more".to_string(),
                            pointer: "/has_more".to_string(),
                            default_value: Some(Value::Bool(false)),
                        }],
                    },
                },
            },
            TrustedIntegrationMethodDefinition {
                name: "resend_send_email".to_string(),
                provider: "resend".to_string(),
                description: "Send an email through a saved Resend org integration.".to_string(),
                prompt_signature:
                    "resend_send_email(from, to, subject, html?, text?, cc?, bcc?, integration_id?)"
                        .to_string(),
                input_schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "integration_id": { "type": "string" },
                        "from": { "type": "string", "description": "RFC 5322 sender string." },
                        "to": {
                            "description": "Recipient email or array of recipient emails.",
                            "oneOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }]
                        },
                        "subject": { "type": "string" },
                        "html": { "type": "string" },
                        "text": { "type": "string" },
                        "cc": {
                            "oneOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }]
                        },
                        "bcc": {
                            "oneOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }]
                        }
                    },
                    "required": ["from", "to", "subject"]
                }),
                runtime: TrustedIntegrationRuntimeSpec::ResendSendEmail,
            },
        ]
    })
}

pub fn trusted_integration_method_by_tool(
    tool_name: &str,
) -> Option<&'static TrustedIntegrationMethodDefinition> {
    trusted_integration_methods()
        .iter()
        .find(|method| method.name == tool_name)
}

pub fn is_trusted_integration_provider(provider: &str) -> bool {
    trusted_integration_methods()
        .iter()
        .any(|method| method.provider == provider)
}

fn arg_binding(
    arg_names: &[&str],
    target: &str,
    value_type: TrustedIntegrationArgValueType,
    required: bool,
    default_value: Option<Value>,
) -> TrustedIntegrationArgBinding {
    TrustedIntegrationArgBinding {
        arg_names: arg_names.iter().map(|name| (*name).to_string()).collect(),
        target: target.to_string(),
        value_type,
        required,
        default_value,
    }
}

fn static_binding(target: &str, value: &str) -> TrustedIntegrationArgBinding {
    TrustedIntegrationArgBinding {
        arg_names: Vec::new(),
        target: target.to_string(),
        value_type: TrustedIntegrationArgValueType::String,
        required: false,
        default_value: Some(Value::String(value.to_string())),
    }
}

fn result_field(output: &str, pointer: &str) -> TrustedIntegrationResultField {
    TrustedIntegrationResultField {
        output: output.to_string(),
        pointer: pointer.to_string(),
    }
}
