import { Button } from "@cypher-asi/zui";
import { X } from "lucide-react";
import { useFeed } from "./FeedProvider";
import styles from "./FeedSidekickHeader.module.css";

export function FeedSidekickHeader() {
  const { selectedEventId, events, selectEvent } = useFeed();

  const event = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;

  if (!event) {
    return <div className={styles.header} />;
  }

  const repoShort = event.repo.split("/").pop();

  return (
    <div className={styles.header}>
      <span className={styles.meta}>{event.author.name}</span>
      <span className={styles.separator}>&middot;</span>
      <span className={styles.meta}>{repoShort}/{event.branch}</span>
      <span className={styles.spacer} />
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={<X size={14} />}
        onClick={() => selectEvent(null)}
      />
    </div>
  );
}
