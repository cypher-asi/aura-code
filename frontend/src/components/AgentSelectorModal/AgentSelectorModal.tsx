import { useMemo } from "react";
import { Modal, Button, Spinner, Text } from "@cypher-asi/zui";
import { EmptyState } from "../EmptyState";
import { Avatar } from "../Avatar";
import type { AgentInstance } from "../../types";
import { AgentEditorModal } from "../AgentEditorModal";
import { useAgentSelectorData } from "./useAgentSelectorData";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";
import styles from "./AgentSelectorModal.module.css";

interface AgentSelectorModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (instance: AgentInstance) => void;
}

export function AgentSelectorModal({ isOpen, projectId, onClose, onCreated }: AgentSelectorModalProps) {
  const { isMobileLayout } = useAuraCapabilities();
  const {
    agents, loading, creating, error, showEditor, setShowEditor,
    handleSelect, handleAgentSaved, handleClose,
  } = useAgentSelectorData(isOpen, projectId, onCreated, onClose);
  const visibleAgents = useMemo(
    () => (isMobileLayout ? agents.filter((agent) => agent.machine_type === "remote") : agents),
    [agents, isMobileLayout],
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={isMobileLayout ? "Add Remote Agent to Project" : "Add Agent to Project"}
        size="md"
        footer={visibleAgents.length > 0 ? (
          <Button variant="ghost" onClick={() => setShowEditor(true)} disabled={!!creating}>
            + Create New Agent
          </Button>
        ) : undefined}
      >
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingWrap}>
              <Spinner size="sm" />
            </div>
          ) : visibleAgents.length === 0 ? (
            <div className={styles.emptyState}>
              <EmptyState>
                {isMobileLayout
                  ? "No remote agents yet. Create one to get started."
                  : "No agents yet. Create one to get started."}
              </EmptyState>
              <div className={styles.emptyActions}>
                <Button variant="primary" onClick={() => setShowEditor(true)} disabled={!!creating}>
                  Create New Agent
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {visibleAgents.map((agent) => (
                <button
                  key={agent.agent_id}
                  className={styles.card}
                  onClick={() => handleSelect(agent)}
                  disabled={!!creating}
                >
                  <div className={styles.cardIcon}>
                    <Avatar
                      avatarUrl={agent.icon ?? undefined}
                      name={agent.name}
                      type="agent"
                      size={48}
                    />
                  </div>
                  <div className={styles.cardName}>{agent.name}</div>
                  {agent.role && <div className={styles.cardRole}>{agent.role}</div>}
                </button>
              ))}
            </div>
          )}
          {error && <Text variant="muted" size="sm" className={styles.error}>{error}</Text>}
        </div>
      </Modal>

      <AgentEditorModal
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSaved={handleAgentSaved}
      />
    </>
  );
}
