use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AppProviderKind {
    Github,
    Linear,
    Slack,
    Notion,
    BraveSearch,
    Freepik,
    Buffer,
    Apify,
    Metricool,
    Mailchimp,
}

#[derive(Clone, Copy, Debug)]
pub struct AppProviderContract {
    pub kind: AppProviderKind,
    pub tool_names: &'static [&'static str],
}

impl AppProviderKind {
    pub fn provider_id(self) -> &'static str {
        match self {
            AppProviderKind::Github => "github",
            AppProviderKind::Linear => "linear",
            AppProviderKind::Slack => "slack",
            AppProviderKind::Notion => "notion",
            AppProviderKind::BraveSearch => "brave_search",
            AppProviderKind::Freepik => "freepik",
            AppProviderKind::Buffer => "buffer",
            AppProviderKind::Apify => "apify",
            AppProviderKind::Metricool => "metricool",
            AppProviderKind::Mailchimp => "mailchimp",
        }
    }
}

pub fn app_provider_contracts() -> &'static [AppProviderContract] {
    &[
        AppProviderContract {
            kind: AppProviderKind::Github,
            tool_names: &["github_list_repos", "github_create_issue"],
        },
        AppProviderContract {
            kind: AppProviderKind::Linear,
            tool_names: &["linear_list_teams", "linear_create_issue"],
        },
        AppProviderContract {
            kind: AppProviderKind::Slack,
            tool_names: &["slack_list_channels", "slack_post_message"],
        },
        AppProviderContract {
            kind: AppProviderKind::Notion,
            tool_names: &["notion_search_pages", "notion_create_page"],
        },
        AppProviderContract {
            kind: AppProviderKind::BraveSearch,
            tool_names: &["brave_search_web", "brave_search_news"],
        },
        AppProviderContract {
            kind: AppProviderKind::Freepik,
            tool_names: &["freepik_list_icons", "freepik_improve_prompt"],
        },
        AppProviderContract {
            kind: AppProviderKind::Buffer,
            tool_names: &["buffer_list_profiles", "buffer_create_update"],
        },
        AppProviderContract {
            kind: AppProviderKind::Apify,
            tool_names: &["apify_list_actors", "apify_run_actor"],
        },
        AppProviderContract {
            kind: AppProviderKind::Metricool,
            tool_names: &["metricool_list_brands", "metricool_list_posts"],
        },
        AppProviderContract {
            kind: AppProviderKind::Mailchimp,
            tool_names: &["mailchimp_list_audiences", "mailchimp_list_campaigns"],
        },
    ]
}

pub fn app_provider_contract_by_tool(tool_name: &str) -> Option<&'static AppProviderContract> {
    app_provider_contracts()
        .iter()
        .find(|contract| contract.tool_names.iter().any(|name| *name == tool_name))
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrgIntegrationToolManifestEntry {
    pub name: String,
    pub provider: Option<String>,
    pub description: String,
    pub prompt_signature: String,
    pub input_schema: Value,
}

pub fn org_integration_tool_manifest_entries() -> &'static [OrgIntegrationToolManifestEntry] {
    static ENTRIES: OnceLock<Vec<OrgIntegrationToolManifestEntry>> = OnceLock::new();
    ENTRIES.get_or_init(|| {
        serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../infra/shared/org-integration-tools.json"
        )))
        .expect("org integration tool manifest should parse")
    })
}

#[cfg(test)]
mod tests {
    use std::collections::{HashMap, HashSet};

    use super::*;

    #[test]
    fn manifest_matches_provider_contracts() {
        let manifest_by_provider = org_integration_tool_manifest_entries().iter().fold(
            HashMap::<&str, HashSet<&str>>::new(),
            |mut acc, entry| {
                if let Some(provider) = entry.provider.as_deref() {
                    acc.entry(provider).or_default().insert(entry.name.as_str());
                }
                acc
            },
        );

        for contract in app_provider_contracts() {
            let actual = manifest_by_provider
                .get(contract.kind.provider_id())
                .cloned()
                .unwrap_or_default();
            let expected = contract.tool_names.iter().copied().collect::<HashSet<_>>();
            assert_eq!(actual, expected);
        }
    }
}
