import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Text } from "@cypher-asi/zui";
import { useAgentApp } from "./AgentAppProvider";
import styles from "../../components/ResponsivePanel.module.css";

export function AgentsResponsiveControls() {
  const { agents, loading, selectedAgent } = useAgentApp();
  const navigate = useNavigate();
  const { agentId } = useParams();

  const activeAgent = useMemo(
    () =>
      (agentId ? agents.find((agent) => agent.agent_id === agentId) : null) ??
      (selectedAgent?.agent_id === agentId ? selectedAgent : null) ??
      selectedAgent ??
      agents[0] ??
      null,
    [agentId, agents, selectedAgent],
  );

  if (!activeAgent) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <Text size="sm" weight="medium">{activeAgent.name}</Text>
        <Text size="sm" variant="muted" className={styles.meta}>
          {loading
            ? "Loading agents"
            : activeAgent.role
              ? `${activeAgent.role} / Global agent chat`
              : `${agents.length} agent${agents.length === 1 ? "" : "s"} available`}
        </Text>
      </div>

      {agents.length > 1 && (
        <div className={styles.controls}>
          <select
            aria-label="Choose agent"
            value={activeAgent.agent_id}
            onChange={(event) => navigate(`/agents/${event.target.value}`)}
            className={styles.select}
          >
            {agents.map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}
