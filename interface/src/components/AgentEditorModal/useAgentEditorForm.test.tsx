import { renderHook } from "@testing-library/react";
import type { Agent } from "../../types";
import { useAgentEditorForm } from "./useAgentEditorForm";

const mockUseAuraCapabilities = vi.fn();

vi.mock("../../hooks/use-aura-capabilities", () => ({
  useAuraCapabilities: () => mockUseAuraCapabilities(),
}));

vi.mock("../../hooks/use-modal-initial-focus", () => ({
  useModalInitialFocus: () => ({
    inputRef: { current: null },
    initialFocusRef: undefined,
  }),
}));

vi.mock("../../api/client", () => ({
  api: {
    agents: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../stores/org-store", () => ({
  useOrgStore: (selector: (state: { activeOrg: null; integrations: never[] }) => unknown) =>
    selector({ activeOrg: null, integrations: [] }),
}));

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    agent_id: "agent-1" as Agent["agent_id"],
    user_id: "user-1",
    name: "Atlas",
    role: "Builder",
    personality: "Calm",
    system_prompt: "Help out",
    skills: [],
    icon: null,
    org_id: "org-1",
    machine_type: "local",
    adapter_type: "aura_harness",
    environment: "local_host",
    integration_id: null,
    default_model: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useAgentEditorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuraCapabilities.mockReturnValue({ isMobileLayout: false });
  });

  it("defaults new desktop agents to local_host aura harness", () => {
    const { result } = renderHook(() =>
      useAgentEditorForm(true, undefined, vi.fn(), vi.fn()),
    );

    expect(result.current.adapterType).toBe("aura_harness");
    expect(result.current.environment).toBe("local_host");
  });

  it("defaults new mobile agents to swarm microvm", () => {
    mockUseAuraCapabilities.mockReturnValue({ isMobileLayout: true });

    const { result } = renderHook(() =>
      useAgentEditorForm(true, undefined, vi.fn(), vi.fn()),
    );

    expect(result.current.environment).toBe("swarm_microvm");
  });

  it("preserves an existing agent environment while editing on mobile", () => {
    mockUseAuraCapabilities.mockReturnValue({ isMobileLayout: true });

    const { result } = renderHook(() =>
      useAgentEditorForm(true, makeAgent({ machine_type: "local", environment: "local_host" }), vi.fn(), vi.fn()),
    );

    expect(result.current.environment).toBe("local_host");
  });
});
