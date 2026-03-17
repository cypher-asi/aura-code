import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Text } from "@cypher-asi/zui";
import { Lane } from "../../components/Lane";
import { ConnectionDot } from "../../components/ConnectionDot";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";
import { useAgentApp } from "./AgentAppProvider";

function MobileAgentHeader() {
  const { agents, loading, selectedAgent } = useAgentApp();
  const navigate = useNavigate();
  const { agentId } = useParams();

  const activeAgent =
    (agentId ? agents.find((agent) => agent.agent_id === agentId) : null) ??
    (selectedAgent?.agent_id === agentId ? selectedAgent : null) ??
    selectedAgent ??
    agents[0] ??
    null;

  const selectedAgentId = activeAgent?.agent_id ?? agentId ?? "";
  const secondaryLabel = loading
    ? "Loading agents"
    : activeAgent?.role
      ? `${activeAgent.role} / Global agent chat`
      : agents.length > 0
        ? `${agents.length} agent${agents.length === 1 ? "" : "s"} available`
        : "Global agent chat";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        borderBottom: "1px solid var(--color-border)",
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
        <ConnectionDot />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Text size="sm" weight="medium" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {activeAgent?.name ?? "Agents"}
          </Text>
          <Text variant="muted" size="xs">
            {secondaryLabel}
          </Text>
        </div>
      </div>

      {agents.length > 1 && (
        <select
          aria-label="Choose agent"
          value={selectedAgentId}
          onChange={(event) => navigate(`/agents/${event.target.value}`)}
          style={{
            width: "100%",
            background: "var(--color-bg-tertiary, #2a2a2a)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            color: "inherit",
            fontSize: 13,
            padding: "8px 10px",
          }}
        >
          {agents.map((agent) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function AgentMainPanel() {
  const { supportsDesktopWorkspace } = useAuraCapabilities();

  if (!supportsDesktopWorkspace) {
    return (
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <MobileAgentHeader />
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <Lane
      flex
      style={{ borderLeft: "1px solid var(--color-border)" }}
      taskbar={
        <div style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "stretch" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: "var(--space-3)",
              paddingRight: "var(--space-2)",
              flexShrink: 0,
            }}
          >
            <ConnectionDot />
          </div>
        </div>
      }
    >
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <Outlet />
      </main>
    </Lane>
  );
}
