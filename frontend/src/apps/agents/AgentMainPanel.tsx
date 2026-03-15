import { Outlet, useParams } from "react-router-dom";
import { Text } from "@cypher-asi/zui";
import { Bot } from "lucide-react";
import { Lane } from "../../components/Lane";

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "var(--space-3)" }}>
      <Bot size={32} style={{ opacity: 0.3 }} />
      <Text variant="muted" size="sm">Select an agent to view details</Text>
    </div>
  );
}

export function AgentMainPanel() {
  const { agentId } = useParams();

  return (
    <Lane flex style={{ borderLeft: "1px solid var(--color-border)" }}>
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {agentId ? <Outlet /> : <EmptyState />}
      </main>
    </Lane>
  );
}
