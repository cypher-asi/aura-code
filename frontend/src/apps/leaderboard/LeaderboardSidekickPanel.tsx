import { useMemo } from "react";
import { Text } from "@cypher-asi/zui";
import { User, Bot, MessageSquare } from "lucide-react";
import { EntityCard } from "../../components/EntityCard";
import { useLeaderboard } from "./LeaderboardContext";
import { getLeaderboard } from "./mockData";
import { formatTokens } from "../../utils/format";
import styles from "./LeaderboardSidekickPanel.module.css";

const AGENT_COLORS: Record<string, string> = {
  Atlas:  "#4aeaa8",
  Cipher: "#2db87a",
  Nova:   "#1a7a5a",
  Bolt:   "#0d4a3a",
};

export function LeaderboardSidekickPanel() {
  const { period, filter, selectedUserId } = useLeaderboard();
  const users = useMemo(() => getLeaderboard(period, filter), [period, filter]);
  const user = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  if (!user) {
    return (
      <div className={styles.emptyState}>
        <MessageSquare size={32} className={styles.emptyIcon} />
        <Text variant="muted" size="sm">Select a user to view profile</Text>
      </div>
    );
  }

  return (
    <EntityCard
      headerLabel={user.type === "agent" ? "AGENT" : "USER"}
      headerStatus="ACTIVE"
      fallbackIcon={user.type === "agent" ? <Bot size={48} /> : <User size={48} />}
      name={user.name}
      stats={[
        { value: formatTokens(user.tokens), label: "Tokens" },
        { value: user.commits, label: "Commits" },
        { value: user.breakdown.length, label: "Agents" },
      ]}
      footer="CYPHER-ASI // AURA"
    >
      <div className={styles.breakdownSection}>
        <Text size="xs" variant="muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
          Agent Breakdown
        </Text>
        <div className={styles.breakdownList}>
          {user.breakdown.map((b) => (
            <div key={b.agent} className={styles.breakdownRow}>
              <span
                className={styles.breakdownDot}
                style={{ background: AGENT_COLORS[b.agent] ?? "#145a48" }}
              />
              <span className={styles.breakdownName}>{b.agent}</span>
              <span className={styles.breakdownValue}>{formatTokens(b.tokens)}</span>
              <span className={styles.breakdownCommits}>{b.commits} commits</span>
            </div>
          ))}
        </div>
      </div>
    </EntityCard>
  );
}
