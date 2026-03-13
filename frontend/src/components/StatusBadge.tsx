import styles from "./StatusBadge.module.css";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cls = styles[status] || styles.pending;
  const label = status.replace(/_/g, " ");
  return (
    <span className={`${styles.badge} ${cls}`}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}
