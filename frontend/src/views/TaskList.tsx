import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Spec, Task } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { Spinner } from "@cypher-asi/zui";
import styles from "./views.module.css";

export function TaskList() {
  const { projectId } = useParams<{ projectId: string }>();
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([api.listSpecs(projectId), api.listTasks(projectId)])
      .then(([s, t]) => {
        setSpecs(s.sort((a, b) => a.order_index - b.order_index));
        setTasks(t.sort((a, b) => a.order_index - b.order_index));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Spinner />;

  const specMap = new Map(specs.map((s) => [s.spec_id, s]));
  const groupedTasks = specs.map((spec) => ({
    spec,
    tasks: tasks.filter((t) => t.spec_id === spec.spec_id),
  }));

  const ungrouped = tasks.filter((t) => !specMap.has(t.spec_id));

  return (
    <div>
      <div className={styles.viewHeader}>
        <h1 className={styles.viewTitle}>Tasks</h1>
        <p className={styles.viewSubtitle}>
          {tasks.length} tasks across {specs.length} specs
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No tasks yet</h3>
          <p>Go to the project page and click "Extract Tasks" to create them.</p>
        </div>
      ) : (
        <>
          {groupedTasks.map(({ spec, tasks: specTasks }) => (
            <div key={spec.spec_id}>
              <div className={styles.taskGroupHeader}>
                {spec.title} ({specTasks.length})
              </div>
              {specTasks.map((task) => (
                <div key={task.task_id}>
                  <div
                    className={styles.taskRow}
                    onClick={() =>
                      setExpanded(expanded === task.task_id ? null : task.task_id)
                    }
                  >
                    <span className={styles.taskOrder}>#{task.order_index}</span>
                    <StatusBadge status={task.status} />
                    <span className={styles.taskTitle}>{task.title}</span>
                  </div>
                  {expanded === task.task_id && (
                    <div className={styles.taskExpanded}>
                      <p>{task.description}</p>
                      {task.execution_notes && (
                        <p style={{ marginTop: 8, color: "var(--color-text-dim)" }}>
                          <strong>Notes:</strong> {task.execution_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <div className={styles.taskGroupHeader}>Other ({ungrouped.length})</div>
              {ungrouped.map((task) => (
                <div key={task.task_id}>
                  <div
                    className={styles.taskRow}
                    onClick={() =>
                      setExpanded(expanded === task.task_id ? null : task.task_id)
                    }
                  >
                    <span className={styles.taskOrder}>#{task.order_index}</span>
                    <StatusBadge status={task.status} />
                    <span className={styles.taskTitle}>{task.title}</span>
                  </div>
                  {expanded === task.task_id && (
                    <div className={styles.taskExpanded}>
                      <p>{task.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
