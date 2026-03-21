/* eslint-disable react-refresh/only-export-components */
import { useEffect } from "react";
import type { ReactNode } from "react";
import type { Agent } from "../../types";
import { useAgentStore, useAgents, useSelectedAgent } from "./stores";

export function AgentAppProvider({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    useAgentStore.getState().fetchAgents();
  }, []);
  return <>{children}</>;
}

export function useAgentApp(): {
  agents: Agent[];
  loading: boolean;
  selectedAgent: Agent | null;
  selectAgent: (a: Agent | null) => void;
  refresh: () => Promise<void>;
} {
  const { agents, status, fetchAgents } = useAgents();
  const { selectedAgent, setSelectedAgent } = useSelectedAgent();
  return {
    agents,
    loading: status === "loading",
    selectedAgent,
    selectAgent: (a) => setSelectedAgent(a?.agent_id ?? null),
    refresh: fetchAgents,
  };
}
