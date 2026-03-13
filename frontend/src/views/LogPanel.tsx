import { Panel, Heading, Text } from "@cypher-asi/zui";
import { useLogStream } from "../hooks/use-log-stream";
import styles from "./aura.module.css";

export function LogPanel() {
  const { lines, contentRef, handleScroll } = useLogStream();

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
        {lines.map((line, i) => (
          <div key={i} className={styles.logLine}>
            <span className={styles.logTimestamp}>[{line.timestamp}]</span>
            <span className={line.isEvent ? styles.logEvent : undefined}>
              {line.message}
            </span>
          </div>
        ))}
        {lines.length === 0 && (
          <Text variant="muted" size="sm">Waiting for events...</Text>
        )}
      </div>
    </Panel>
  );
}
