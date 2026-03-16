import { MessageSquare } from "lucide-react";
import { useFeed } from "./FeedProvider";
import { timeAgo } from "./FeedMainPanel";
import styles from "./FeedSidekickHeader.module.css";

export function FeedSidekickHeader() {
  const { selectedEventId, events } = useFeed();

  const event = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;

  if (!event) {
    return (
      <div className={styles.header}>
        <MessageSquare size={14} />
        <span className={styles.title}>Comments</span>
      </div>
    );
  }

  const repoShort = event.repo.split("/").pop();

  return (
    <div className={styles.header}>
      <MessageSquare size={14} />
      <span className={styles.title}>Comments</span>
      <span className={styles.separator}>·</span>
      <span className={styles.meta}>{event.author.name}</span>
      <span className={styles.separator}>·</span>
      <span className={styles.meta}>{repoShort}/{event.branch}</span>
      <span className={styles.time}>{timeAgo(event.timestamp)}</span>
    </div>
  );
}
