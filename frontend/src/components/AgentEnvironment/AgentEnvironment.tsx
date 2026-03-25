import { useState, useRef, useEffect, useCallback } from "react";
import { useEnvironmentInfo } from "../../hooks/use-environment-info";
import styles from "./AgentEnvironment.module.css";

interface AgentEnvironmentProps {
  machineType: "local" | "remote";
}

export function AgentEnvironment({ machineType }: AgentEnvironmentProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { data } = useEnvironmentInfo();
  const isLocal = machineType === "local";

  const handleMouseEnter = useCallback(() => setOpen(true), []);
  const handleMouseLeave = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={styles.indicator}>
        <span className={`${styles.dot} ${isLocal ? styles.dotLocal : styles.dotRemote}`} />
        {isLocal ? "Local" : "Remote"}
      </span>

      {open && (
        <div className={styles.statusCard}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Status</span>
            <span className={styles.statusValue}>{isLocal ? "Running locally" : "Remote agent"}</span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>IP</span>
            <span className={styles.statusValue}>{data?.ip ?? "—"}</span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>File Path</span>
            <span className={styles.statusValue}>{data?.cwd ?? "—"}</span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>OS</span>
            <span className={styles.statusValue}>
              {data ? `${data.os} (${data.architecture})` : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
