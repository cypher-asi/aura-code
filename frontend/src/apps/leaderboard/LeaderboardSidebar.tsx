import { useMemo, useCallback } from "react";
import { Explorer } from "@cypher-asi/zui";
import type { ExplorerNode } from "@cypher-asi/zui";
import { Calendar, CalendarDays, Clock } from "lucide-react";
import { useLeaderboard } from "./LeaderboardContext";
import type { TimePeriod } from "./mockData";
import styles from "./LeaderboardSidebar.module.css";

const periods: { id: TimePeriod; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All Time", icon: <Calendar size={14} /> },
  { id: "month", label: "This Month", icon: <CalendarDays size={14} /> },
  { id: "week", label: "This Week", icon: <Clock size={14} /> },
];

export function LeaderboardSidebar() {
  const { period, setPeriod } = useLeaderboard();

  const data: ExplorerNode[] = useMemo(
    () => periods.map((p) => ({ id: p.id, label: p.label, icon: p.icon })),
    [],
  );

  const defaultSelectedIds = useMemo(() => [period], [period]);

  const handleSelect = useCallback(
    (ids: string[]) => {
      const id = ids[ids.length - 1] as TimePeriod | undefined;
      if (id) setPeriod(id);
    },
    [setPeriod],
  );

  return (
    <div className={styles.list}>
      <Explorer
        data={data}
        enableDragDrop={false}
        enableMultiSelect={false}
        defaultSelectedIds={defaultSelectedIds}
        onSelect={handleSelect}
      />
    </div>
  );
}
