export interface ModelOption {
  id: string;
  label: string;
  tier: "opus" | "sonnet" | "haiku";
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "claude-opus-4-6", label: "Opus 4.6", tier: "opus" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", tier: "sonnet" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", tier: "haiku" },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];
export const CODEX_MODELS: ModelOption[] = [
  { id: "codex", label: "Codex", tier: "sonnet" },
];

export const GEMINI_MODELS: ModelOption[] = [
  { id: "auto", label: "Auto", tier: "sonnet" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "opus" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "sonnet" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "haiku" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "sonnet" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", tier: "haiku" },
];

export const OPENCODE_MODELS: ModelOption[] = [
  { id: "openai/gpt-5.2-codex", label: "openai/gpt-5.2-codex", tier: "sonnet" },
  { id: "openai/gpt-5.4", label: "openai/gpt-5.4", tier: "opus" },
  { id: "openai/gpt-5.2", label: "openai/gpt-5.2", tier: "sonnet" },
  { id: "openai/gpt-5.1-codex-max", label: "openai/gpt-5.1-codex-max", tier: "opus" },
  { id: "openai/gpt-5.1-codex-mini", label: "openai/gpt-5.1-codex-mini", tier: "haiku" },
];

export const CURSOR_MODELS: ModelOption[] = [
  { id: "auto", label: "auto", tier: "sonnet" },
  { id: "gpt-5.3-codex", label: "gpt-5.3-codex", tier: "opus" },
  { id: "sonnet-4.6", label: "sonnet-4.6", tier: "opus" },
  { id: "gemini-3-pro", label: "gemini-3-pro", tier: "opus" },
];

function storageKey(adapterType?: string): string {
  return `aura-selected-model:${adapterType ?? "default"}`;
}

export function availableModelsForAdapter(adapterType?: string): ModelOption[] {
  switch (adapterType) {
    case "codex":
      return CODEX_MODELS;
    case "gemini_cli":
      return GEMINI_MODELS;
    case "opencode":
      return OPENCODE_MODELS;
    case "cursor":
      return CURSOR_MODELS;
    default:
      return AVAILABLE_MODELS;
  }
}

export function defaultModelForAdapter(
  adapterType?: string,
  explicitDefault?: string | null,
): string {
  const models = availableModelsForAdapter(adapterType);
  if (explicitDefault && explicitDefault.trim()) {
    return explicitDefault;
  }
  return models[0]?.id ?? DEFAULT_MODEL.id;
}

export function loadPersistedModel(
  adapterType?: string,
  explicitDefault?: string | null,
): string {
  try {
    const models = availableModelsForAdapter(adapterType);
    const stored = localStorage.getItem(storageKey(adapterType));
    if (stored && models.some((m) => m.id === stored)) return stored;
  } catch {}
  return defaultModelForAdapter(adapterType, explicitDefault);
}

export function persistModel(modelId: string, adapterType?: string): void {
  try {
    localStorage.setItem(storageKey(adapterType), modelId);
  } catch {}
}

export function modelLabel(
  modelId: string,
  adapterType?: string,
  explicitDefault?: string | null,
): string {
  const models = availableModelsForAdapter(adapterType);
  return (
    models.find((m) => m.id === modelId)?.label ??
    models.find((m) => m.id === explicitDefault)?.label ??
    explicitDefault ??
    DEFAULT_MODEL.label
  );
}
