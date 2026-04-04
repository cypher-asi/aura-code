import type { OrgIntegration } from "../types";

export type IntegrationKind = "model" | "tool";

export interface IntegrationDefinition {
  id: string;
  label: string;
  kind: IntegrationKind;
  description: string;
  secretLabel: string;
  secretPlaceholder: string;
  supportsDefaultModel: boolean;
  runtimeCompatibleAdapters: string[];
}

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "model",
    description: "Claude models for Aura and Claude Code runtime execution.",
    secretLabel: "Anthropic API Key",
    secretPlaceholder: "Paste the Anthropic API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: ["aura_harness", "claude_code"],
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "model",
    description: "OpenAI-backed models and API credentials for Codex-style execution.",
    secretLabel: "OpenAI API Key",
    secretPlaceholder: "Paste the OpenAI API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: ["codex"],
  },
  {
    id: "google_gemini",
    label: "Google Gemini",
    kind: "model",
    description: "Gemini model access for future runtime support and shared org setup.",
    secretLabel: "Gemini API Key",
    secretPlaceholder: "Paste the Gemini API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "xai",
    label: "xAI",
    kind: "model",
    description: "Grok model access for future runtime support.",
    secretLabel: "xAI API Key",
    secretPlaceholder: "Paste the xAI API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "groq",
    label: "Groq",
    kind: "model",
    description: "Fast hosted inference with a shared org-level key.",
    secretLabel: "Groq API Key",
    secretPlaceholder: "Paste the Groq API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "model",
    description: "Aggregator access to multiple model vendors through one integration.",
    secretLabel: "OpenRouter API Key",
    secretPlaceholder: "Paste the OpenRouter API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "together",
    label: "Together AI",
    kind: "model",
    description: "Hosted open-weight model access for future runtime support.",
    secretLabel: "Together API Key",
    secretPlaceholder: "Paste the Together API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "mistral",
    label: "Mistral",
    kind: "model",
    description: "Mistral-hosted model access for future runtime support.",
    secretLabel: "Mistral API Key",
    secretPlaceholder: "Paste the Mistral API key",
    supportsDefaultModel: true,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "github",
    label: "GitHub",
    kind: "tool",
    description: "Repository, PR, issue, and automation access across org projects.",
    secretLabel: "GitHub Token",
    secretPlaceholder: "Paste the GitHub token",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "linear",
    label: "Linear",
    kind: "tool",
    description: "Task tracking and sprint operations at the org level.",
    secretLabel: "Linear API Key",
    secretPlaceholder: "Paste the Linear API key",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "brave_search",
    label: "Brave Search",
    kind: "tool",
    description: "Web search and research access for shared team workflows.",
    secretLabel: "Brave Search API Key",
    secretPlaceholder: "Paste the Brave Search API key",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "apify",
    label: "Apify",
    kind: "tool",
    description: "Web scraping and automation jobs using a shared org token.",
    secretLabel: "Apify API Token",
    secretPlaceholder: "Paste the Apify API token",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "buffer",
    label: "Buffer",
    kind: "tool",
    description: "Publishing and scheduling workflows for social channels.",
    secretLabel: "Buffer Access Token",
    secretPlaceholder: "Paste the Buffer access token",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "metricool",
    label: "Metricool",
    kind: "tool",
    description: "Cross-channel social analytics and reporting access.",
    secretLabel: "Metricool API Token",
    secretPlaceholder: "Paste the Metricool API token",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "mailchimp",
    label: "Mailchimp",
    kind: "tool",
    description: "Audience, campaign, and email marketing operations.",
    secretLabel: "Mailchimp API Key",
    secretPlaceholder: "Paste the Mailchimp API key",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "freepik",
    label: "Freepik",
    kind: "tool",
    description: "Image and creative-generation asset access for content workflows.",
    secretLabel: "Freepik API Key",
    secretPlaceholder: "Paste the Freepik API key",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "slack",
    label: "Slack",
    kind: "tool",
    description: "Shared workspace messaging and notification workflows.",
    secretLabel: "Slack Bot Token",
    secretPlaceholder: "Paste the Slack bot token",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
  {
    id: "notion",
    label: "Notion",
    kind: "tool",
    description: "Docs, knowledge base, and workspace data access.",
    secretLabel: "Notion Integration Token",
    secretPlaceholder: "Paste the Notion integration token",
    supportsDefaultModel: false,
    runtimeCompatibleAdapters: [],
  },
];

const CATALOG_BY_ID = new Map(INTEGRATION_CATALOG.map((definition) => [definition.id, definition]));

export function getIntegrationDefinition(provider: string): IntegrationDefinition | undefined {
  return CATALOG_BY_ID.get(provider);
}

export function getIntegrationLabel(provider: string): string {
  return getIntegrationDefinition(provider)?.label ?? provider;
}

export function getSecretLabel(provider: string): string {
  return getIntegrationDefinition(provider)?.secretLabel ?? "Provider API Key";
}

export function getSecretPlaceholder(provider: string): string {
  return getIntegrationDefinition(provider)?.secretPlaceholder ?? "Paste the provider API key";
}

export function supportsDefaultModel(provider: string): boolean {
  return getIntegrationDefinition(provider)?.supportsDefaultModel ?? true;
}

export function runtimeAuthProviderForAdapter(adapterType: string): string | null {
  if (adapterType === "aura_harness") return "anthropic";
  if (adapterType === "claude_code") return "anthropic";
  if (adapterType === "codex") return "openai";
  return null;
}

export function filterRuntimeCompatibleIntegrations(
  adapterType: string,
  integrations: OrgIntegration[],
): OrgIntegration[] {
  const requiredProvider = runtimeAuthProviderForAdapter(adapterType);
  if (!requiredProvider) return [];
  return integrations.filter((integration) => integration.provider === requiredProvider);
}

export function integrationSections(): Array<{
  id: IntegrationKind;
  title: string;
  description: string;
  providers: IntegrationDefinition[];
}> {
  return [
    {
      id: "model",
      title: "Model Integrations",
      description: "Shared API credentials for model vendors and runtime BYOK paths.",
      providers: INTEGRATION_CATALOG.filter((provider) => provider.kind === "model"),
    },
    {
      id: "tool",
      title: "Tool Integrations",
      description: "Shared org credentials for task systems, search, content, and workflow tools.",
      providers: INTEGRATION_CATALOG.filter((provider) => provider.kind === "tool"),
    },
  ];
}
