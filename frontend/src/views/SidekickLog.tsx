import { Text } from "@cypher-asi/zui";
import { useLogStream } from "../hooks/use-log-stream";
import styles from "../components/Sidekick.module.css";

export function SidekickLog() {
  const { lines, contentRef, handleScroll } = useLogStream();

  return (
    <div className={styles.logWrap}>
      <div className={styles.logHeader} />
      <div
        ref={contentRef}
        className={styles.logContent}
        onScroll={handleScroll}
      >
        {lines.length === 0 ? (
          <Text variant="muted" size="sm">Waiting for events...</Text>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={styles.logLine}>
              <span className={styles.logTimestamp}>[{line.timestamp}]</span>
              <span className={line.isEvent ? styles.logEvent : undefined}>
                {line.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
