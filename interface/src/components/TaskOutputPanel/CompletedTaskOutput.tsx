import { useEffect, useRef } from "react";
import { Check, X as XIcon, AlertTriangle } from "lucide-react";
import { useTaskOutput, useEventStore } from "../../stores/event-store";
import { api } from "../../api/client";
import { useTaskOutputPanelStore, type PanelTaskStatus } from "../../stores/task-output-panel-store";
import { MessageBubble } from "../MessageBubble";
import styles from "./TaskOutputPanel.module.css";

interface CompletedTaskOutputProps {
  taskId: string;
  projectId: string;
  title: string;
  status: PanelTaskStatus;
}

function useHydrateCompletedOutput(projectId: string, taskId: string) {
  const seedTaskOutput = useEventStore((s) => s.seedTaskOutput);
  const hydratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (hydratedRef.current === taskId) return;
    hydratedRef.current = taskId;

    const existing = useEventStore.getState().taskOutputs[taskId];
    if (existing?.text) return;

    api.getTaskOutput(projectId, taskId)
      .then((res) => {
        if (res.output) {
          seedTaskOutput(taskId, res.output);
        }
      })
      .catch(() => {});
  }, [projectId, taskId, seedTaskOutput]);
}

export function CompletedTaskOutput({ taskId, projectId, title, status }: CompletedTaskOutputProps) {
  const taskOutput = useTaskOutput(taskId);
  const dismissTask = useTaskOutputPanelStore((s) => s.dismissTask);

  useHydrateCompletedOutput(projectId, taskId);

  const statusIcon = status === "failed"
    ? <AlertTriangle size={10} />
    : <Check size={10} />;

  const dotClass = status === "failed" ? styles.taskDotFailed : styles.taskDotCompleted;
  const statusLabel = status === "failed" ? "Failed" : "Done";

  return (
    <div className={styles.taskSection}>
      <div className={styles.taskHeader}>
        <span className={dotClass}>{statusIcon}</span>
        <span className={styles.taskTitle}>{title || taskId}</span>
        <span className={styles.taskStatusBadge} data-status={status}>{statusLabel}</span>
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={() => dismissTask(taskId)}
          title="Dismiss"
          aria-label="Dismiss task output"
        >
          <XIcon size={10} />
        </button>
      </div>
      {taskOutput.text ? (
        <div className={styles.taskBody}>
          <MessageBubble
            message={{ id: `completed-${taskId}`, role: "assistant", content: taskOutput.text }}
          />
        </div>
      ) : null}
    </div>
  );
}
