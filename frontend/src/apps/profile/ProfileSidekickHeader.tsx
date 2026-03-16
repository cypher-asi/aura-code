import { Button } from "@cypher-asi/zui";
import { X } from "lucide-react";
import { useProfile } from "./ProfileProvider";
import styles from "./ProfileSidekickHeader.module.css";

export function ProfileSidekickHeader() {
  const { selectedEventId, events, selectEvent } = useProfile();

  const event = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;

  if (!event) {
    return (
      <div className={styles.header}>
        <span className={styles.meta}>Profile</span>
      </div>
    );
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
