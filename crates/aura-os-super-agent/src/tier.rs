use aura_os_core::ToolDomain;

const TIER1_DOMAINS: &[ToolDomain] = &[
    ToolDomain::Project,
    ToolDomain::Agent,
    ToolDomain::Execution,
    ToolDomain::Monitoring,
];

pub fn classify_intent(message: &str) -> Vec<ToolDomain> {
    let mut domains: Vec<ToolDomain> = TIER1_DOMAINS.to_vec();
    let lower = message.to_lowercase();

    if contains_any(&lower, &["org", "organization", "team", "member", "invite"]) {
        domains.push(ToolDomain::Org);
    }
    if contains_any(
        &lower,
        &[
            "bill", "credit", "balance", "cost", "pay", "checkout", "purchase",
        ],
    ) {
        domains.push(ToolDomain::Billing);
    }
    if contains_any(&lower, &["feed", "post", "comment", "follow", "social"]) {
        domains.push(ToolDomain::Social);
    }
    if contains_any(
        &lower,
        &["task", "extract", "transition", "retry", "run task"],
    ) {
        domains.push(ToolDomain::Task);
    }
    if contains_any(
        &lower,
        &["spec", "specification", "requirements", "generate spec"],
    ) {
        domains.push(ToolDomain::Spec);
    }
    if contains_any(
        &lower,
        &[
            "file",
            "browse",
            "directory",
            "system info",
            "environment",
            "remote",
            "vm",
        ],
    ) {
        domains.push(ToolDomain::System);
    }
    if contains_any(
        &lower,
        &["image", "generate image", "3d", "model", "render", "logo"],
    ) {
        domains.push(ToolDomain::Generation);
    }

    domains.dedup();
    domains
}

fn contains_any(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|kw| text.contains(kw))
}

pub fn is_tier1(domain: &ToolDomain) -> bool {
    TIER1_DOMAINS.contains(domain)
}
