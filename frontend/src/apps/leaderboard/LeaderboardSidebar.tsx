import { useMemo } from "react";
import { Text } from "@cypher-asi/zui";
import { useLeaderboard } from "./LeaderboardContext";
import { getLeaderboard, type TimePeriod } from "./mockData";
import { formatTokens } from "../../utils/format";
import styles from "./LeaderboardSidebar.module.css";

const periods: { value: TimePeriod; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

const medals = ["🥇", "🥈", "🥉"];

export function LeaderboardSidebar() {
  const { period, setPeriod } = useLeaderboard();
  const top3 = useMemo(() => getLeaderboard(period).slice(0, 3), [period]);

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <Text variant="muted" size="xs" className={styles.sectionLabel}>
          Time Period
        </Text>
        <div className={styles.filters}>
          {periods.map((p) => (
            <button
              key={p.value}
              className={`${styles.filterBtn} ${period === p.value ? styles.active : ""}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <Text variant="muted" size="xs" className={styles.sectionLabel}>
          Top 3
        </Text>
        <div className={styles.podium}>
          {top3.map((user, i) => (
            <div key={user.id} className={styles.podiumEntry}>
              <span className={styles.medal}>{medals[i]}</span>
              <div className={styles.podiumInfo}>
                <Text size="sm" className={styles.podiumName}>
                  {user.name}
                </Text>
                <Text variant="muted" size="xs">
                  {formatTokens(user.tokens)} tokens
                </Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
