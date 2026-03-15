import { Text, Badge } from "@cypher-asi/zui";
import { Bot } from "lucide-react";
import { useAgentApp } from "./AgentAppProvider";
import styles from "./AgentInfoPanel.module.css";

export function AgentInfoPanel() {
  const { selectedAgent } = useAgentApp();

  if (!selectedAgent) {
    return (
      <div className={styles.empty}>
        <Text variant="muted" size="sm">Select an agent to see details</Text>
      </div>
    );
  }

  const a = selectedAgent;

  return (
    <div className={styles.container}>
      <div className={styles.avatarLarge}>
        {a.icon ? (
          <img src={a.icon} alt="" className={styles.avatarImg} />
        ) : (
          <Bot size={48} />
        )}
      </div>

      <Text weight="semibold" size="lg" style={{ textAlign: "center" }}>{a.name}</Text>
      <Text variant="muted" size="sm" style={{ textAlign: "center" }}>{a.role}</Text>

      {a.personality && (
        <div className={styles.section}>
          <Text size="xs" variant="muted" weight="medium">Personality</Text>
          <Text size="sm">{a.personality}</Text>
        </div>
      )}

      <div className={styles.section}>
        <Text size="xs" variant="muted" weight="medium">Created</Text>
        <Text size="sm">{new Date(a.created_at).toLocaleDateString()}</Text>
      </div>

      {a.skills.length > 0 && (
        <div className={styles.section}>
          <Text size="xs" variant="muted" weight="medium">Skills</Text>
          <div className={styles.skills}>
            {a.skills.map((s) => <Badge key={s} variant="pending">{s}</Badge>)}
          </div>
        </div>
      )}

      {a.system_prompt && (
        <div className={styles.section}>
          <Text size="xs" variant="muted" weight="medium">System Prompt</Text>
          <Text size="sm" className={styles.prompt}>{a.system_prompt.slice(0, 300)}{a.system_prompt.length > 300 ? "…" : ""}</Text>
        </div>
      )}
    </div>
  );
}
