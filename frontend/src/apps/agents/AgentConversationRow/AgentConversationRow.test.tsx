import { render, screen } from "@testing-library/react";
import type { Agent } from "../../../types";

vi.mock("../../../components/Avatar", () => ({
  Avatar: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock("../../../hooks/use-avatar-state", () => ({
  useAvatarState: () => ({
    status: "idle",
    isLocal: false,
  }),
}));

import { AgentConversationRow } from "./AgentConversationRow";

const baseAgent: Agent = {
  agent_id: "agent-1",
  user_id: "user-1",
  name: "Rose",
  role: "Architect",
  personality: "Plans features end to end.",
  system_prompt: "",
  skills: [],
  icon: null,
  machine_type: "local",
  created_at: "2026-03-20T00:00:00Z",
  updated_at: "2026-03-20T00:00:00Z",
};

describe("AgentConversationRow", () => {
  it("shows the agent role and summary without any chat preview", () => {
    render(
      <AgentConversationRow
        agent={baseAgent}
        isSelected={false}
        onClick={() => {}}
        onContextMenu={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /Rose/i })).toBeInTheDocument();
    expect(screen.getByText("Architect")).toBeInTheDocument();
    expect(screen.getByText("Plans features end to end.")).toBeInTheDocument();
  });

  it("falls back to a generic prompt when the agent has no summary fields", () => {
    render(
      <AgentConversationRow
        agent={{ ...baseAgent, role: "", personality: "" }}
        isSelected={false}
        onClick={() => {}}
        onContextMenu={() => {}}
      />,
    );

    expect(screen.getByText("Open this agent")).toBeInTheDocument();
  });
});
