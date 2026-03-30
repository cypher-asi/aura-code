import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { PageEmptyState, Text } from "@cypher-asi/zui";
import { Loader2, SquareKanban } from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import { ResponsiveMainLane } from "../../../components/ResponsiveMainLane";
import { TaskStatusIcon } from "../../../components/TaskStatusIcon";
import { useProjectsListStore } from "../../../stores/projects-list-store";
import { useSidekickStore } from "../../../stores/sidekick-store";
import { useKanbanData } from "../hooks/useKanbanData";
import type { TaskStatus } from "../../../types";
import styles from "./TasksMainPanel.module.css";

const LANE_CONFIG: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "to_do", label: "To Do" },
  { status: "pending", label: "Pending" },
  { status: "ready", label: "Ready" },
  { status: "in_progress", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
  { status: "failed", label: "Failed" },
];

export function TasksMainPanel({ children: _children }: { children?: React.ReactNode }) {
  const { projectId, agentInstanceId } = useParams<{ projectId: string; agentInstanceId: string }>();
  const viewTask = useSidekickStore((s) => s.viewTask);
  const refreshProjectAgents = useProjectsListStore((s) => s.refreshProjectAgents);
  const projectAgents = useProjectsListStore((s) => (
    projectId ? s.agentsByProject[projectId] : undefined
  ));
  const { lanes, loading } = useKanbanData(projectId, agentInstanceId);
  const agentById = useMemo(
    () => new Map((projectAgents ?? []).map((agent) => [agent.agent_instance_id, agent])),
    [projectAgents],
  );

  useEffect(() => {
    if (!projectId) return;
    if (!projectAgents) {
      void refreshProjectAgents(projectId);
    }
  }, [projectId, projectAgents, refreshProjectAgents]);

  if (!projectId) {
    return (
      <ResponsiveMainLane>
        <PageEmptyState
          icon={<SquareKanban size={32} />}
          title="Tasks"
          description="Select a project from navigation to view its task board."
        />
      </ResponsiveMainLane>
    );
  }

  return (
    <ResponsiveMainLane>
      <div className={styles.root}>
        <div className={styles.boardViewport}>
          <div className={styles.board}>
            {LANE_CONFIG.map((lane) => {
              const laneTasks = lanes[lane.status] ?? [];
              return (
                <section key={lane.status} className={styles.column}>
                  <header className={styles.columnHeader}>
                    <Text size="xs" className={styles.columnTitle}>{lane.label}</Text>
                    <span className={styles.countBadge}>{laneTasks.length}</span>
                  </header>
                  <div className={styles.columnBody}>
                    {laneTasks.length === 0 ? (
                      <Text size="xs" variant="muted" className={styles.emptyLabel}>No tasks</Text>
                    ) : (
                      laneTasks.map((task) => {
                        const assignedAgent = task.assigned_agent_instance_id
                          ? agentById.get(task.assigned_agent_instance_id)
                          : undefined;
                        return (
                          <button
                            key={task.task_id}
                            type="button"
                            className={styles.taskCard}
                            onClick={() => viewTask(task)}
                          >
                            {assignedAgent && (
                              <span className={styles.assigneeAvatar}>
                                <Avatar
                                  avatarUrl={assignedAgent.icon ?? undefined}
                                  name={assignedAgent.name}
                                  type="agent"
                                  size={16}
                                />
                              </span>
                            )}
                            <span className={styles.taskCardMeta}>
                              <TaskStatusIcon status={task.status} />
                            </span>
                            <span className={styles.taskCardText}>{task.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className={styles.loadingOverlay}>
            <Loader2 size={14} className={styles.spinner} />
            <Text size="xs" variant="muted">Refreshing tasks...</Text>
          </div>
        )}
      </div>
    </ResponsiveMainLane>
  );
}
