import type { ProjectId, SpecId, TaskId, TaskStatus, Task, ProjectProgress, BuildStepRecord, TestStepRecord } from "../types";
import { apiFetch } from "./core";

export const tasksApi = {
  listTasks: (projectId: ProjectId) =>
    apiFetch<Task[]>(`/api/projects/${projectId}/tasks`),
  listTasksBySpec: (projectId: ProjectId, specId: SpecId) =>
    apiFetch<Task[]>(`/api/projects/${projectId}/specs/${specId}/tasks`),
  transitionTask: (
    projectId: ProjectId,
    taskId: TaskId,
    newStatus: TaskStatus,
  ) =>
    apiFetch<Task>(
      `/api/projects/${projectId}/tasks/${taskId}/transition`,
      {
        method: "POST",
        body: JSON.stringify({ new_status: newStatus }),
      },
    ),
  retryTask: (projectId: ProjectId, taskId: TaskId) =>
    apiFetch<Task>(`/api/projects/${projectId}/tasks/${taskId}/retry`, {
      method: "POST",
    }),
  runTask: (projectId: ProjectId, taskId: TaskId, agentInstanceId?: string) => {
    const params = agentInstanceId ? `?agent_instance_id=${agentInstanceId}` : "";
    return apiFetch<void>(`/api/projects/${projectId}/tasks/${taskId}/run${params}`, {
      method: "POST",
    });
  },
  getProgress: (projectId: ProjectId) =>
    apiFetch<ProjectProgress>(`/api/projects/${projectId}/progress`),
  getTaskOutput: (projectId: ProjectId, taskId: TaskId) =>
    apiFetch<{ output: string; build_steps?: BuildStepRecord[]; test_steps?: TestStepRecord[] }>(`/api/projects/${projectId}/tasks/${taskId}/output`),
};
