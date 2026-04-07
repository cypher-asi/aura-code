use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use aura_os_integrations::org_integration_tool_manifest_entries;
use serde::Deserialize;
use serde_json::Value;

use aura_os_core::{Agent, OrgId};
use aura_os_link::{InstalledIntegration, InstalledTool, ToolAuth};

use crate::state::AppState;

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum WorkspaceToolSourceKind {
    AuraNative,
    AppProvider,
    Mcp,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceToolManifestEntry {
    name: String,
    provider: Option<String>,
    description: String,
    prompt_signature: String,
    input_schema: Value,
    saved_event: Option<String>,
    saved_payload_key: Option<String>,
}

#[allow(dead_code)]
#[derive(Clone, Debug)]
pub(crate) struct WorkspaceToolDefinition {
    pub(crate) name: String,
    pub(crate) provider: Option<String>,
    pub(crate) description: String,
    pub(crate) prompt_signature: String,
    pub(crate) input_schema: Value,
    pub(crate) saved_event: Option<String>,
    pub(crate) saved_payload_key: Option<String>,
    pub(crate) source_kind: WorkspaceToolSourceKind,
    #[allow(dead_code)]
    pub(crate) source_id: String,
}

fn load_manifest_entries(
    entries: &[WorkspaceToolManifestEntry],
    label: &str,
    source_kind: WorkspaceToolSourceKind,
    source_id: &str,
) -> Vec<WorkspaceToolDefinition> {
    entries
        .iter()
        .cloned()
        .map(|tool| {
            assert!(
                tool.input_schema.is_object(),
                "{label} workspace tool `{}` must declare an object input schema",
                tool.name
            );
            WorkspaceToolDefinition {
                name: tool.name,
                provider: tool.provider,
                description: tool.description,
                prompt_signature: tool.prompt_signature,
                input_schema: tool.input_schema,
                saved_event: tool.saved_event,
                saved_payload_key: tool.saved_payload_key,
                source_kind,
                source_id: source_id.to_string(),
            }
        })
        .collect()
}

pub(crate) fn shared_workspace_tools() -> &'static [WorkspaceToolDefinition] {
    static TOOLS: OnceLock<Vec<WorkspaceToolDefinition>> = OnceLock::new();
    TOOLS.get_or_init(|| {
        let mut tools = Vec::new();
        let project_entries: Vec<WorkspaceToolManifestEntry> = serde_json::from_str(include_str!(
            concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../../infra/shared/project-control-plane-tools.json"
            )
        ))
        .expect("workspace tool manifest should parse");
        tools.extend(load_manifest_entries(
            &project_entries,
            "aura native",
            WorkspaceToolSourceKind::AuraNative,
            "aura_project_control_plane",
        ));
        let integration_entries = org_integration_tool_manifest_entries()
            .iter()
            .cloned()
            .map(|entry| WorkspaceToolManifestEntry {
                name: entry.name,
                provider: entry.provider,
                description: entry.description,
                prompt_signature: entry.prompt_signature,
                input_schema: entry.input_schema,
                saved_event: None,
                saved_payload_key: None,
            })
            .collect::<Vec<_>>();
        tools.extend(load_manifest_entries(
            &integration_entries,
            "app provider",
            WorkspaceToolSourceKind::AppProvider,
            "builtin_app_providers",
        ));
        tools
    })
}

pub(crate) fn workspace_tool(name: &str) -> Option<&'static WorkspaceToolDefinition> {
    shared_workspace_tools()
        .iter()
        .find(|tool| tool.name == name)
}

fn available_workspace_integration_providers_for_org(
    state: &AppState,
    org_id: &OrgId,
) -> HashSet<String> {
    state
        .org_service
        .list_integrations(org_id)
        .map(|integrations| {
            integrations
                .into_iter()
                .filter(|integration| {
                    integration.has_secret
                        && integration.enabled
                        && matches!(
                            integration.kind,
                            aura_os_core::OrgIntegrationKind::WorkspaceIntegration
                        )
                })
                .map(|integration| integration.provider)
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn active_workspace_tools_for_org(
    state: &AppState,
    org_id: &OrgId,
) -> Vec<&'static WorkspaceToolDefinition> {
    let available_providers = available_workspace_integration_providers_for_org(state, org_id);
    shared_workspace_tools()
        .iter()
        .filter(|tool| {
            tool.provider
                .as_deref()
                .map(|provider| available_providers.contains(provider))
                .unwrap_or(true)
        })
        .collect()
}

pub(crate) fn active_workspace_tools<'a>(
    state: &'a AppState,
    agent: &'a Agent,
) -> Vec<&'static WorkspaceToolDefinition> {
    let Some(org_id) = agent.org_id.as_ref() else {
        return Vec::new();
    };

    active_workspace_tools_for_org(state, org_id)
}

pub(crate) fn control_plane_api_base_url() -> String {
    if let Some(url) = std::env::var("AURA_CONTROL_PLANE_API_BASE_URL")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
    {
        return url;
    }

    let port = std::env::var("AURA_SERVER_PORT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "3100".to_string());
    let host = std::env::var("AURA_SERVER_HOST")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let normalized_host = match host.as_str() {
        "0.0.0.0" | "::" => "127.0.0.1".to_string(),
        other if other.contains(':') && !other.starts_with('[') => format!("[{other}]"),
        other => other.to_string(),
    };

    format!("http://{normalized_host}:{port}")
}

pub(crate) fn installed_workspace_app_tools(
    state: &AppState,
    org_id: &OrgId,
    bearer_token: &str,
) -> Vec<InstalledTool> {
    let base_url = control_plane_api_base_url();
    active_workspace_tools_for_org(state, org_id)
        .into_iter()
        .filter(|tool| matches!(tool.source_kind, WorkspaceToolSourceKind::AppProvider))
        .map(|tool| InstalledTool {
            name: tool.name.clone(),
            description: tool.description.clone(),
            input_schema: tool.input_schema.clone(),
            endpoint: format!("{base_url}/api/orgs/{org_id}/tool-actions/{}", tool.name),
            auth: ToolAuth::Bearer {
                token: bearer_token.to_string(),
            },
            timeout_ms: Some(30_000),
            namespace: Some("aura_org_tools".to_string()),
            metadata: HashMap::from([
                (
                    "required_integration_provider".to_string(),
                    Value::String(tool.provider.clone().unwrap_or_default()),
                ),
                (
                    "required_integration_kind".to_string(),
                    Value::String("workspace_integration".to_string()),
                ),
            ]),
        })
        .collect()
}

pub(crate) fn installed_workspace_integrations_for_org(
    state: &AppState,
    org_id: &OrgId,
) -> Vec<InstalledIntegration> {
    state
        .org_service
        .list_integrations(org_id)
        .map(|integrations| {
            integrations
                .into_iter()
                .filter(|integration| {
                    integration.enabled
                        && match integration.kind {
                            aura_os_core::OrgIntegrationKind::WorkspaceIntegration => {
                                integration.has_secret
                            }
                            aura_os_core::OrgIntegrationKind::McpServer => true,
                            aura_os_core::OrgIntegrationKind::WorkspaceConnection => false,
                        }
                })
                .map(|integration| InstalledIntegration {
                    integration_id: integration.integration_id,
                    name: integration.name,
                    provider: integration.provider,
                    kind: match integration.kind {
                        aura_os_core::OrgIntegrationKind::WorkspaceConnection => {
                            "workspace_connection"
                        }
                        aura_os_core::OrgIntegrationKind::WorkspaceIntegration => {
                            "workspace_integration"
                        }
                        aura_os_core::OrgIntegrationKind::McpServer => "mcp_server",
                    }
                    .to_string(),
                    metadata: HashMap::new(),
                })
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use aura_os_core::{OrgId, OrgIntegrationKind};
    use aura_os_orgs::IntegrationSecretUpdate;

    #[tokio::test]
    async fn installed_workspace_app_tools_include_saved_provider_tools() {
        let db_dir = tempfile::tempdir().unwrap();
        let db_path = db_dir.path().join("settings.db");
        let state = crate::build_app_state(&db_path).expect("build app state");
        let org_id = OrgId::new();

        state
            .org_service
            .upsert_integration(
                &org_id,
                None,
                "Brave Search".to_string(),
                "brave_search".to_string(),
                OrgIntegrationKind::WorkspaceIntegration,
                None,
                None,
                Some(true),
                IntegrationSecretUpdate::Set("brave-secret".to_string()),
            )
            .expect("save brave integration");

        let tools = installed_workspace_app_tools(&state, &org_id, "jwt-123");
        let tool_names = tools
            .iter()
            .map(|tool| tool.name.as_str())
            .collect::<Vec<_>>();

        assert!(tool_names.contains(&"list_org_integrations"));
        assert!(tool_names.contains(&"brave_search_web"));
        assert!(tool_names.contains(&"brave_search_news"));

        let brave = tools
            .iter()
            .find(|tool| tool.name == "brave_search_web")
            .expect("brave_search_web installed");
        assert!(brave.endpoint.contains("/api/orgs/"));
        assert!(brave.endpoint.ends_with("/tool-actions/brave_search_web"));
        assert!(matches!(brave.auth, ToolAuth::Bearer { .. }));
        assert_eq!(
            brave
                .metadata
                .get("required_integration_provider")
                .and_then(Value::as_str),
            Some("brave_search")
        );
        assert_eq!(
            brave
                .metadata
                .get("required_integration_kind")
                .and_then(Value::as_str),
            Some("workspace_integration")
        );
    }

    #[tokio::test]
    async fn installed_workspace_integrations_include_enabled_runtime_capabilities() {
        let db_dir = tempfile::tempdir().unwrap();
        let db_path = db_dir.path().join("settings.db");
        let state = crate::build_app_state(&db_path).expect("build app state");
        let org_id = OrgId::new();

        state
            .org_service
            .upsert_integration(
                &org_id,
                None,
                "Brave Search".to_string(),
                "brave_search".to_string(),
                OrgIntegrationKind::WorkspaceIntegration,
                None,
                None,
                Some(true),
                IntegrationSecretUpdate::Set("brave-secret".to_string()),
            )
            .expect("save brave integration");

        state
            .org_service
            .upsert_integration(
                &org_id,
                None,
                "Filesystem MCP".to_string(),
                "mcp_server".to_string(),
                OrgIntegrationKind::McpServer,
                None,
                Some(serde_json::json!({"command":"npx","args":["-y","pkg"]})),
                Some(true),
                IntegrationSecretUpdate::Preserve,
            )
            .expect("save mcp integration");

        let integrations = installed_workspace_integrations_for_org(&state, &org_id);
        let ids = integrations
            .iter()
            .map(|integration| integration.provider.as_str())
            .collect::<Vec<_>>();

        assert!(ids.contains(&"brave_search"));
        assert!(ids.contains(&"mcp_server"));
    }
}
