import { useShallow } from "zustand/react/shallow";
import { useAgentStore } from "./agent-store";
import type { Agent } from "../../../types";
import type { DisplayMessage } from "../../../types/stream";

type FetchStatus = "idle" | "loading" | "ready" | "error";

type AgentsSlice = {
  agents: Agent[];
  status: FetchStatus;
  error: string | null;
  fetchAgents: () => Promise<void>;
};

export function useAgents(): AgentsSlice {
  return useAgentStore(
    useShallow((s) => ({
      agents: s.agents,
      status: s.agentsStatus,
      error: s.agentsError,
      fetchAgents: s.fetchAgents,
    })),
  );
}

type HistorySlice = {
  messages: DisplayMessage[];
  status: FetchStatus;
  error: string | null;
};

export function useAgentHistory(agentId: string | undefined): HistorySlice {
  return useAgentStore(
    useShallow((s) => {
      if (!agentId) return { messages: [] as DisplayMessage[], status: "idle" as const, error: null };
      const entry = s.history[agentId];
      return entry
        ? { messages: entry.messages, status: entry.status, error: entry.error }
        : { messages: [] as DisplayMessage[], status: "idle" as const, error: null };
    }),
  );
}

type SelectedAgentSlice = {
  selectedAgentId: string | null;
  selectedAgent: Agent | null;
  setSelectedAgent: (agentId: string | null) => void;
};

export function useSelectedAgent(): SelectedAgentSlice {
  return useAgentStore(
    useShallow((s) => ({
      selectedAgentId: s.selectedAgentId,
      selectedAgent:
        s.agents.find((a) => a.agent_id === s.selectedAgentId) ?? null,
      setSelectedAgent: s.setSelectedAgent,
    })),
  );
}
