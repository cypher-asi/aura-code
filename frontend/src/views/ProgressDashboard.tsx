import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ProjectProgress } from "../types";
import { Spinner } from "@cypher-asi/zui";
import styles from "./views.module.css";

export function ProgressDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const load = () => {
      api
        .getProgress(projectId)
        .then(setProgress)
        .catch(console.error)
        .finally(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  if (loading) return <Spinner />;
  if (!progress) {
    return (
      <div className={styles.emptyState}>
        <h3>No progress data</h3>
      </div>
    );
  }

  const pct = Math.round(progress.completion_percentage * 100) / 100;

  return (
    <div>
      <div className={styles.viewHeader}>
        <h1 className={styles.viewTitle}>Progress</h1>
        <p className={styles.viewSubtitle}>
          {progress.done_tasks} of {progress.total_tasks} tasks complete
        </p>
      </div>

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: "var(--color-primary)" }}>
          {pct}%
        </div>
        <div className={styles.progressBarContainer} style={{ maxWidth: 400, margin: "12px auto" }}>
          <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard value={progress.total_tasks} label="Total" color="var(--color-text)" />
        <StatCard value={progress.done_tasks} label="Done" color="var(--status-done)" />
        <StatCard value={progress.in_progress_tasks} label="In Progress" color="var(--status-in-progress)" />
        <StatCard value={progress.ready_tasks} label="Ready" color="var(--status-ready)" />
        <StatCard value={progress.pending_tasks} label="Pending" color="var(--status-pending)" />
        <StatCard value={progress.blocked_tasks} label="Blocked" color="var(--status-blocked)" />
        <StatCard value={progress.failed_tasks} label="Failed" color="var(--status-failed)" />
      </div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={styles.statCard}>
      <div className="value" style={{ color }}>{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
