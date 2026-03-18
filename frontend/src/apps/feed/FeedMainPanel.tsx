import { Button, Text } from "@cypher-asi/zui";
import { GitCommitVertical } from "lucide-react";
import { Lane } from "../../components/Lane";
import { CommitGrid } from "../../components/CommitGrid";
import { ActivityCard } from "../../components/ActivityCard";
import { EmptyState } from "../../components/EmptyState";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";
import { useFeed } from "./FeedProvider";
import { FEED_FILTERS } from "./feedFilters";
import styles from "./FeedMainPanel.module.css";

export { timeAgo } from "../../components/ActivityCard";

export function FeedMainPanel() {
  const { filteredEvents, commitActivity, filter, setFilter, selectedEventId, selectEvent, selectProfile, getCommentsForEvent } = useFeed();
  const { isMobileLayout } = useAuraCapabilities();

  return (
    <Lane flex style={{ borderLeft: "1px solid var(--color-border)" }}>
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          {isMobileLayout && (
            <div className={styles.mobileFilterSection}>
              <div className={styles.mobileFilterHeader}>
                <Text size="sm" weight="medium">Feed scope</Text>
                <Text variant="muted" size="sm">Same filters as desktop, surfaced inline for quick switching.</Text>
              </div>
              <div className={styles.mobileFilterRow} role="tablist" aria-label="Feed filters">
                {FEED_FILTERS.map((item) => (
                  <Button
                    key={item.id}
                    variant={filter === item.id ? "secondary" : "ghost"}
                    size="sm"
                    icon={item.icon}
                    selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    aria-pressed={filter === item.id}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {filteredEvents.length === 0 ? (
            <EmptyState icon={<GitCommitVertical size={32} />}>No activity in your feed yet</EmptyState>
          ) : (
            <>
              <div className={styles.commitGridWrapper}>
                <CommitGrid data={commitActivity} />
              </div>
              <div className={styles.feedList}>
                {filteredEvents.map((evt, i) => (
                  <ActivityCard
                    key={evt.id}
                    event={evt}
                    isLast={i === filteredEvents.length - 1}
                    isSelected={selectedEventId === evt.id}
                    comments={getCommentsForEvent(evt.id)}
                    onSelect={selectEvent}
                    onSelectProfile={(author) => selectProfile({ name: author.name, type: author.type, avatarUrl: author.avatarUrl })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Lane>
  );
}
