import { useMemo, useCallback, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Explorer, ButtonPlus } from "@cypher-asi/zui";
import type { ExplorerNode } from "@cypher-asi/zui";
import { Bot, Loader2 } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { AgentEditorModal } from "../../components/AgentEditorModal";
import { useAgentApp } from "./AgentAppProvider";
import { useSidebarSearch } from "../../context/SidebarSearchContext";
import type { Agent } from "../../types";
import styles from "./AgentList.module.css";

export function AgentList() {
  const { agents, loading, refresh } = useAgentApp();
  const { query: searchQuery, setAction } = useSidebarSearch();
  const navigate = useNavigate();
  const { agentId } = useParams();
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    setAction(
      "agents",
      <ButtonPlus onClick={() => setShowEditor(true)} size="sm" title="New Agent" />,
    );
    return () => setAction("agents", null);
  }, [setAction]);

  const handleAgentSaved = useCallback(
    (agent: Agent) => {
      setShowEditor(false);
      refresh();
      navigate(`/agents/${agent.agent_id}`);
    },
    [refresh, navigate],
  );

  const data: ExplorerNode[] = useMemo(
    () =>
      agents.map((a) => ({
        id: a.agent_id,
        label: a.name,
        icon: a.icon && !failedIcons.has(a.agent_id)
          ? <img
              src={a.icon}
              alt=""
              className={styles.agentAvatar}
              onError={() => setFailedIcons((prev) => new Set(prev).add(a.agent_id))}
            />
          : <Bot size={14} />,
      })),
    [agents, failedIcons],
  );

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((n) => n.label.toLowerCase().includes(q));
  }, [data, searchQuery]);

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
      <>
        <EmptyState>No agents yet</EmptyState>
        <AgentEditorModal
          isOpen={showEditor}
          onClose={() => setShowEditor(false)}
          onSaved={handleAgentSaved}
        />
      </>
    );
  }

  return (
    <div className={styles.list}>
      <Explorer
        data={filteredData}
        enableDragDrop={false}
        enableMultiSelect={false}
        defaultSelectedIds={defaultSelectedIds}
        onSelect={handleSelect}
      />
      <AgentEditorModal
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSaved={handleAgentSaved}
      />
    </div>
  );
}
