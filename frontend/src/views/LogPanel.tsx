import { useState } from "react";
import { Panel, Heading, Text } from "@cypher-asi/zui";
import { useLogStream, EVENT_LABELS } from "../hooks/use-log-stream";
import type { LogEntry } from "../hooks/use-log-stream";
import type { EngineEvent } from "../types/events";
import styles from "./aura.module.css";

const TYPE_CATEGORY: Record<string, string> = {
  Loop: "loop",
  Task: "task",
  Output: "output",
  Files: "files",
  Session: "session",
  Log: "log",
  Spec: "spec",
};

function categoryClass(label: string): string {
  const cat = TYPE_CATEGORY[label] ?? "log";
  return styles[`logBadge_${cat}`] ?? styles.logBadge;
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

export function LogPanel() {
  const { entries, contentRef, handleScroll } = useLogStream();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  return (
    <Panel variant="solid" border="solid" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
        <Heading level={5}>Log Output</Heading>
      </div>
      <div
        ref={contentRef}
        className={styles.logContent}
        onScroll={handleScroll}
      >
        {entries.length === 0 ? (
          <Text variant="muted" size="sm">Waiting for events...</Text>
        ) : (
          entries.map((entry, i) => (
            <LogRow
              key={i}
              entry={entry}
              isSelected={selectedIdx === i}
              onToggle={() => setSelectedIdx(selectedIdx === i ? null : i)}
            />
          ))
        )}
      </div>
    </Panel>
  );
}
