import { useState, useRef, useCallback, useMemo } from "react";
import { Text } from "@cypher-asi/zui";
import { ChevronDown, Check } from "lucide-react";
import { useLogStream, EVENT_LABELS } from "../hooks/use-log-stream";
import { useClickOutside } from "../hooks/use-click-outside";
import type { LogEntry } from "../hooks/use-log-stream";
import type { EngineEvent } from "../types/events";
import styles from "../components/Sidekick.module.css";

const TYPE_CATEGORY: Record<string, string> = {
  Loop: "loop",
  Task: "task",
  Output: "output",
  Files: "files",
  Session: "session",
  Log: "log",
  Spec: "spec",
};

const ALL_CATEGORIES = Object.keys(TYPE_CATEGORY);
const PRIMARY_CATEGORIES = ["Task", "Loop", "Spec", "Files"];
const MORE_CATEGORIES = ALL_CATEGORIES.filter((c) => !PRIMARY_CATEGORIES.includes(c));

function categoryClass(label: string): string {
  const cat = TYPE_CATEGORY[label] ?? "log";
  return styles[`logBadge_${cat}`] ?? styles.logBadge;
}

function chipClass(label: string, active: boolean): string {
  if (!active) return styles.logFilterChip;
  const cat = TYPE_CATEGORY[label] ?? "all";
  return styles[`logFilterChipActive_${cat}`] ?? styles.logFilterChip;
}

function LogFilterBar({
  active,
  onToggle,
  onToggleAll,
}: {
  active: Set<string>;
  onToggle: (category: string) => void;
  onToggleAll: () => void;
}) {
  const allActive = active.size === ALL_CATEGORIES.length;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useClickOutside(moreRef, () => setMoreOpen(false), moreOpen);

  return (
    <div className={styles.logFilterBar}>
      <button
        className={allActive ? styles.logFilterChipActive_all : styles.logFilterChip}
        onClick={onToggleAll}
      >
        All
      </button>
      {PRIMARY_CATEGORIES.map((cat) => (
        <button
          key={cat}
          className={chipClass(cat, active.has(cat))}
          onClick={() => onToggle(cat)}
        >
          {cat}
        </button>
      ))}
      <div ref={moreRef} className={styles.logFilterMore}>
        <button
          className={styles.logFilterChip}
          onClick={() => setMoreOpen((v) => !v)}
        >
          More <ChevronDown size={10} style={{ marginLeft: 2, verticalAlign: "middle" }} />
        </button>
        {moreOpen && (
          <div className={styles.logFilterDropdown}>
            {MORE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={styles.logFilterDropdownItem}
                onClick={() => onToggle(cat)}
              >
                <span className={styles.logFilterDropdownCheck}>
                  {active.has(cat) && <Check size={12} />}
                </span>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailView({ event }: { event: EngineEvent }) {
  const pairs: [string, string][] = [];

  if (event.task_id) pairs.push(["Task ID", event.task_id]);
  if (event.task_title) pairs.push(["Title", event.task_title]);
  if (event.reason) pairs.push(["Reason", event.reason]);
  if (event.attempt != null) pairs.push(["Attempt", String(event.attempt)]);
  if (event.execution_notes) pairs.push(["Notes", event.execution_notes]);
  if (event.project_id) pairs.push(["Project", event.project_id]);
  if (event.agent_id) pairs.push(["Agent", event.agent_id]);
  if (event.old_session_id) pairs.push(["Old Session", event.old_session_id]);
  if (event.new_session_id) pairs.push(["New Session", event.new_session_id]);
  if (event.completed_count != null) pairs.push(["Completed", String(event.completed_count)]);
  if (event.outcome) pairs.push(["Outcome", event.outcome]);
  if (event.stage) pairs.push(["Stage", event.stage]);
  if (event.spec_count != null) pairs.push(["Spec Count", String(event.spec_count)]);
  if (event.files_written != null) pairs.push(["Files Written", String(event.files_written)]);
  if (event.files_deleted != null) pairs.push(["Files Deleted", String(event.files_deleted)]);
  if (event.delta) pairs.push(["Delta", event.delta]);
  if (event.message) pairs.push(["Message", event.message]);
  if (event.spec) pairs.push(["Spec", event.spec.title]);
  if (event.files && event.files.length > 0) {
    pairs.push(["Files", event.files.map((f) => `${f.op}: ${f.path}`).join("\n")]);
  }

  if (pairs.length === 0) {
    return (
      <div className={styles.logDetail}>
        <Text variant="muted" size="xs">No additional detail</Text>
      </div>
    );
  }

  return (
    <div className={styles.logDetail}>
      {pairs.map(([key, value]) => (
        <div key={key} className={styles.logDetailRow}>
          <span className={styles.logDetailKey}>{key}</span>
          <span className={styles.logDetailValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function LogRow({
  entry,
  isSelected,
  onToggle,
}: {
  entry: LogEntry;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const label = EVENT_LABELS[entry.type] ?? "Event";
  return (
    <>
      <div
        className={`${styles.logRow} ${isSelected ? styles.logRowSelected : ""}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
      >
        <span className={styles.logTimestamp}>{entry.timestamp}</span>
        <span className={`${styles.logBadge} ${categoryClass(label)}`}>{label}</span>
        <span className={styles.logSummary}>{entry.summary}</span>
      </div>
      {isSelected && <DetailView event={entry.detail} />}
    </>
  );
}

export function SidekickLog() {
  const { entries, contentRef, handleScroll, connected } = useLogStream();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(ALL_CATEGORIES),
  );

  const toggleFilter = useCallback((category: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setSelectedIdx(null);
  }, []);

  const toggleAll = useCallback(() => {
    setActiveFilters((prev) =>
      prev.size === ALL_CATEGORIES.length ? new Set<string>() : new Set(ALL_CATEGORIES),
    );
    setSelectedIdx(null);
  }, []);

  const filtered = useMemo(
    () => entries.filter((e) => activeFilters.has(EVENT_LABELS[e.type] ?? "")),
    [entries, activeFilters],
  );

  return (
    <div className={styles.logWrap}>
      <div className={styles.logHeader}>
        <span className={styles.logStatusDot} data-connected={connected} />
        <Text variant="muted" size="xs">
          {connected ? "Connected" : "Disconnected"}
        </Text>
      </div>
      <LogFilterBar active={activeFilters} onToggle={toggleFilter} onToggleAll={toggleAll} />
      <div
        ref={contentRef}
        className={styles.logContent}
        onScroll={handleScroll}
      >
        {filtered.length === 0 ? (
          <Text variant="muted" size="sm">
            {entries.length === 0
              ? connected
                ? "Listening — events will appear when automation runs or specs are generated."
                : "Connecting to event stream..."
              : "No events match the current filters."}
          </Text>
        ) : (
          filtered.map((entry, i) => (
            <LogRow
              key={i}
              entry={entry}
              isSelected={selectedIdx === i}
              onToggle={() => setSelectedIdx(selectedIdx === i ? null : i)}
            />
          ))
        )}
      </div>
    </div>
  );
}
