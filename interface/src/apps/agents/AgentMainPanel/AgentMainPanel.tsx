import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ResponsiveMainLane } from "../../../components/ResponsiveMainLane";
import { useTerminalPanelStore } from "../../../stores/terminal-panel-store";
import { AgentInfoPanel } from "../AgentInfoPanel";
import { LAST_AGENT_ID_KEY, useAgents, useSelectedAgent } from "../stores";
import { useTerminalTarget } from "../../../hooks/use-terminal-target";

export function AgentMainPanel({ children }: { children?: ReactNode }) {
  const { agentId } = useParams<{ agentId: string }>();
  const { fetchAgents, status: agentsStatus } = useAgents();
  const { setSelectedAgent, selectedAgent } = useSelectedAgent();
  const setRemoteAgentId = useTerminalPanelStore((s) => s.setRemoteAgentId);

  useEffect(() => {
    fetchAgents().catch(() => {});
  }, [fetchAgents]);

  useEffect(() => {
    setSelectedAgent(agentId ?? null);
    if (agentId) {
      localStorage.setItem(LAST_AGENT_ID_KEY, agentId);
    }
  }, [agentId, setSelectedAgent]);

  const { remoteAgentId, status } = useTerminalTarget({
    agentId,
    selectedAgent,
    agentsStatus,
  });

  useEffect(() => {
    if (status !== "ready") return;
    setRemoteAgentId(remoteAgentId);
  }, [remoteAgentId, status, setRemoteAgentId]);

  return (
    <ResponsiveMainLane>
      {children ?? <AgentInfoPanel />}
    </ResponsiveMainLane>
  );
}
