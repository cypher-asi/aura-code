import { useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Text, Explorer } from "@cypher-asi/zui";
import type { ExplorerNode } from "@cypher-asi/zui";
import { Bot, Loader2 } from "lucide-react";
import { useAgentApp } from "./AgentAppProvider";
import styles from "./AgentList.module.css";

export function AgentList() {
  const { agents, loading } = useAgentApp();
  const navigate = useNavigate();
  const { agentId } = useParams();

  const data: ExplorerNode[] = useMemo(
    () =>
      agents.map((a) => ({
        id: a.agent_id,
        label: a.name,
        icon: <Bot size={14} />,
      })),
    [agents],
  );

  const defaultSelectedIds = useMemo(
    () => (agentId ? [agentId] : []),
    [agentId],
  );

  const handleSelect = useCallback(
    (ids: string[]) => {
      const id = ids[ids.length - 1];
      if (id) navigate(`/agents/${id}`);
    },
    [navigate],
  );

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 size={18} className={styles.spin} />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className={styles.empty}>
        <Text variant="muted" size="sm">No agents yet</Text>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      <Explorer
        data={data}
        searchable
        searchPlaceholder="Search Agents..."
        enableDragDrop={false}
        enableMultiSelect={false}
        defaultSelectedIds={defaultSelectedIds}
        onSelect={handleSelect}
      />
    </div>
  );
}
