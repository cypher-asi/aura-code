#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const apiBaseUrl = requiredEnv("AURA_MCP_API_BASE_URL");
const projectId = requiredEnv("AURA_MCP_PROJECT_ID");
const jwt = requiredEnv("AURA_MCP_JWT");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function api(path, init = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`.trim());
  }

  return text ? JSON.parse(text) : null;
}

function normalizeMarkdownContents(args) {
  const markdownContents = args?.markdown_contents ?? args?.markdownContents;
  if (typeof markdownContents !== "string" || !markdownContents.trim()) {
    throw new Error("create_spec requires a non-empty markdownContents string");
  }
  return markdownContents.trim();
}

function normalizeTitle(args) {
  const title = args?.title;
  if (typeof title !== "string" || !title.trim()) {
    throw new Error("create_spec requires a non-empty title string");
  }
  return title.trim();
}

function optionalTrimmedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function nextOrderIndex() {
  const specs = await api(`/api/projects/${projectId}/specs`);
  if (!Array.isArray(specs) || specs.length === 0) {
    return 0;
  }
  return Math.max(
    ...specs.map((spec) => (typeof spec?.order_index === "number" ? spec.order_index : 0)),
  ) + 1;
}

function normalizeSpecId(args) {
  const specId = args?.spec_id ?? args?.specId;
  if (typeof specId !== "string" || !specId.trim()) {
    throw new Error("tool requires a non-empty spec_id string");
  }
  return specId.trim();
}

function normalizeDescription(args) {
  const description = args?.description;
  if (typeof description !== "string" || !description.trim()) {
    throw new Error("create_task requires a non-empty description string");
  }
  return description.trim();
}

function normalizeDependencyIds(args) {
  const dependencyIds = args?.dependency_ids ?? args?.dependencyIds;
  if (dependencyIds == null) {
    return [];
  }
  if (!Array.isArray(dependencyIds) || dependencyIds.some((value) => typeof value !== "string")) {
    throw new Error("dependency_ids must be an array of strings");
  }
  return dependencyIds.map((value) => value.trim()).filter(Boolean);
}

function normalizeTaskId(args) {
  const taskId = args?.task_id ?? args?.taskId;
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw new Error("tool requires a non-empty task_id string");
  }
  return taskId.trim();
}

function normalizeOptionalStatus(args) {
  const status = args?.status;
  if (status == null) {
    return undefined;
  }
  if (typeof status !== "string" || !status.trim()) {
    throw new Error("status must be a non-empty string when provided");
  }
  return status.trim();
}

function normalizeNewStatus(args) {
  const newStatus = args?.status ?? args?.new_status ?? args?.newStatus;
  if (typeof newStatus !== "string" || !newStatus.trim()) {
    throw new Error("transition_task requires a non-empty status string");
  }
  return newStatus.trim();
}

function requiredAgentInstanceId() {
  const agentInstanceId = process.env.AURA_MCP_AGENT_INSTANCE_ID?.trim();
  if (!agentInstanceId) {
    throw new Error(
      "run_task and loop control require AURA_MCP_AGENT_INSTANCE_ID to be set by the Aura OS server",
    );
  }
  return agentInstanceId;
}

function currentAgentLoopQuery() {
  const agentInstanceId = requiredAgentInstanceId();
  return `?agent_instance_id=${encodeURIComponent(agentInstanceId)}`;
}

async function listSpecs() {
  const specs = await api(`/api/projects/${projectId}/specs`);
  return {
    specs: Array.isArray(specs)
      ? specs.map((spec) => ({
        spec_id: spec.spec_id,
        title: spec.title,
        order: spec.order_index,
      }))
      : [],
  };
}

async function getSpec(args) {
  const specId = normalizeSpecId(args);
  const spec = await api(`/api/projects/${projectId}/specs/${specId}`);
  return { spec };
}

async function createSpec(args) {
  const title = normalizeTitle(args);
  const markdownContents = normalizeMarkdownContents(args);
  const orderIndex = await nextOrderIndex();
  const spec = await api(`/api/projects/${projectId}/specs`, {
    method: "POST",
    body: JSON.stringify({
      title,
      markdownContents,
      orderIndex,
    }),
  });
  return { spec };
}

async function updateSpec(args) {
  const specId = normalizeSpecId(args);
  const title = optionalTrimmedString(args?.title);
  const markdownContents = optionalTrimmedString(args?.markdown_contents ?? args?.markdownContents);
  if (!title && !markdownContents) {
    throw new Error("update_spec requires at least one of title or markdown_contents");
  }
  const spec = await api(`/api/projects/${projectId}/specs/${specId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(title ? { title } : {}),
      ...(markdownContents ? { markdown_contents: markdownContents } : {}),
    }),
  });
  return { spec };
}

async function deleteSpec(args) {
  const specId = normalizeSpecId(args);
  await api(`/api/projects/${projectId}/specs/${specId}`, {
    method: "DELETE",
  });
  return { deleted: specId };
}

async function listTasks(args) {
  const specId = typeof (args?.spec_id ?? args?.specId) === "string"
    ? (args.spec_id ?? args.specId).trim()
    : null;
  const tasks = await api(`/api/projects/${projectId}/tasks`);
  return {
    tasks: Array.isArray(tasks)
      ? tasks
        .filter((task) => !specId || task.spec_id === specId)
        .map((task) => ({
          task_id: task.task_id,
          spec_id: task.spec_id,
          title: task.title,
          status: task.status,
        }))
      : [],
  };
}

async function getTask(args) {
  const taskId = normalizeTaskId(args);
  const task = await api(`/api/projects/${projectId}/tasks/${taskId}`);
  return { task };
}

async function nextTaskOrderIndex(specId) {
  const tasks = await api(`/api/projects/${projectId}/tasks`);
  const sameSpecTasks = Array.isArray(tasks)
    ? tasks.filter((task) => task.spec_id === specId)
    : [];
  if (sameSpecTasks.length === 0) {
    return 0;
  }
  return Math.max(
    ...sameSpecTasks.map((task) => (typeof task?.order_index === "number" ? task.order_index : 0)),
  ) + 1;
}

async function createTask(args) {
  const specId = normalizeSpecId(args);
  const title = normalizeTitle(args);
  const description = normalizeDescription(args);
  const dependencyIds = normalizeDependencyIds(args);
  const orderIndex = await nextTaskOrderIndex(specId);
  const task = await api(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      spec_id: specId,
      title,
      description,
      order_index: orderIndex,
      dependency_ids: dependencyIds,
    }),
  });
  return { task };
}

async function updateTask(args) {
  const taskId = normalizeTaskId(args);
  const title = optionalTrimmedString(args?.title);
  const description = optionalTrimmedString(args?.description);
  const status = normalizeOptionalStatus(args);
  if (!title && !description && !status) {
    throw new Error("update_task requires at least one of title, description, or status");
  }
  const task = await api(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(status ? { status } : {}),
    }),
  });
  return { task };
}

async function deleteTask(args) {
  const taskId = normalizeTaskId(args);
  const specId = normalizeSpecId(args);
  await api(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
  });
  return { deleted: taskId, spec_id: specId };
}

async function transitionTask(args) {
  const taskId = normalizeTaskId(args);
  const status = normalizeNewStatus(args);
  const task = await api(`/api/projects/${projectId}/tasks/${taskId}/transition`, {
    method: "POST",
    body: JSON.stringify({
      new_status: status,
    }),
  });
  return { task };
}

async function retryTask(args) {
  const taskId = normalizeTaskId(args);
  const task = await api(`/api/projects/${projectId}/tasks/${taskId}/retry`, {
    method: "POST",
  });
  return { task };
}

async function runTask(args) {
  const taskId = normalizeTaskId(args);
  const agentInstanceId = requiredAgentInstanceId();
  await api(
    `/api/projects/${projectId}/tasks/${taskId}/run?agent_instance_id=${encodeURIComponent(agentInstanceId)}`,
    { method: "POST" },
  );
  return {
    task_run: {
      task_id: taskId,
      agent_instance_id: agentInstanceId,
      status: "requested",
    },
  };
}

async function getProject() {
  const project = await api(`/api/projects/${projectId}`);
  return { project };
}

async function updateProject(args) {
  const name = optionalTrimmedString(args?.name);
  const description = optionalTrimmedString(args?.description);
  const buildCommand = optionalTrimmedString(args?.build_command ?? args?.buildCommand);
  const testCommand = optionalTrimmedString(args?.test_command ?? args?.testCommand);
  if (!name && !description && !buildCommand && !testCommand) {
    throw new Error(
      "update_project requires at least one of name, description, build_command, or test_command",
    );
  }
  const project = await api(`/api/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
      ...(buildCommand ? { build_command: buildCommand } : {}),
      ...(testCommand ? { test_command: testCommand } : {}),
    }),
  });
  return { project };
}

async function getProjectStats() {
  const result = await api(`/api/projects/${projectId}/stats`);
  return { result };
}

async function startDevLoop() {
  const loopStatus = await api(`/api/projects/${projectId}/loop/start${currentAgentLoopQuery()}`, {
    method: "POST",
  });
  return { loop_status: loopStatus };
}

async function pauseDevLoop() {
  const loopStatus = await api(`/api/projects/${projectId}/loop/pause${currentAgentLoopQuery()}`, {
    method: "POST",
  });
  return { loop_status: loopStatus };
}

async function stopDevLoop() {
  const loopStatus = await api(`/api/projects/${projectId}/loop/stop${currentAgentLoopQuery()}`, {
    method: "POST",
  });
  return { loop_status: loopStatus };
}

async function getLoopStatus() {
  const loopStatus = await api(`/api/projects/${projectId}/loop/status${currentAgentLoopQuery()}`);
  return { loop_status: loopStatus };
}

const server = new Server(
  {
    name: "aura-control-plane",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_specs",
      description: "List persisted Aura specs for the currently attached project.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "create_spec",
      description:
        "Create and persist a real Aura project spec for the currently attached project.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description: "Short human-readable title for the spec.",
          },
          markdown_contents: {
            type: "string",
            description:
              "Full markdown body of the spec that should be saved into Aura OS.",
          },
        },
        required: ["title", "markdown_contents"],
      },
    },
    {
      name: "get_spec",
      description: "Fetch one persisted Aura spec by spec_id.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          spec_id: {
            type: "string",
            description: "UUID of the spec to fetch.",
          },
        },
        required: ["spec_id"],
      },
    },
    {
      name: "update_spec",
      description: "Update an existing Aura spec's title or markdown contents.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          spec_id: {
            type: "string",
            description: "UUID of the spec to update.",
          },
          title: {
            type: "string",
            description: "Optional replacement title.",
          },
          markdown_contents: {
            type: "string",
            description: "Optional replacement markdown body.",
          },
        },
        required: ["spec_id"],
      },
    },
    {
      name: "delete_spec",
      description: "Delete an existing Aura spec and its tasks.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          spec_id: {
            type: "string",
            description: "UUID of the spec to delete.",
          },
        },
        required: ["spec_id"],
      },
    },
    {
      name: "list_tasks",
      description: "List persisted Aura tasks for the currently attached project.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          spec_id: {
            type: "string",
            description: "Optional spec UUID to filter tasks to a single spec.",
          },
        },
      },
    },
    {
      name: "get_task",
      description: "Fetch one persisted Aura task by task_id.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to fetch.",
          },
        },
        required: ["task_id"],
      },
    },
    {
      name: "create_task",
      description: "Create and persist a real Aura task under an existing project spec.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          spec_id: {
            type: "string",
            description: "UUID of the parent spec from list_specs.",
          },
          title: {
            type: "string",
            description: "Short human-readable title for the task.",
          },
          description: {
            type: "string",
            description: "Full task description that should be saved into Aura OS.",
          },
          dependency_ids: {
            type: "array",
            items: { type: "string" },
            description: "Optional task UUIDs this task depends on.",
          },
        },
        required: ["spec_id", "title", "description"],
      },
    },
    {
      name: "update_task",
      description: "Update an existing Aura task's title, description, or status.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to update.",
          },
          title: {
            type: "string",
            description: "Optional replacement title.",
          },
          description: {
            type: "string",
            description: "Optional replacement description.",
          },
          status: {
            type: "string",
            description: "Optional replacement status.",
          },
        },
        required: ["task_id"],
      },
    },
    {
      name: "delete_task",
      description: "Delete an existing Aura task.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to delete.",
          },
          spec_id: {
            type: "string",
            description: "UUID of the parent spec for parity with shared task tool semantics.",
          },
        },
        required: ["task_id", "spec_id"],
      },
    },
    {
      name: "transition_task",
      description: "Transition a task to a new status (e.g. pending -> ready, ready -> done).",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to update.",
          },
          status: {
            type: "string",
            description: "Target task status, such as ready, in_progress, done, blocked, or failed.",
          },
        },
        required: ["task_id", "status"],
      },
    },
    {
      name: "retry_task",
      description: "Retry a failed or blocked task by returning it to ready.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to retry.",
          },
        },
        required: ["task_id"],
      },
    },
    {
      name: "run_task",
      description: "Trigger execution of a single task by the Aura dev-loop engine.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to run.",
          },
        },
        required: ["task_id"],
      },
    },
    {
      name: "get_project",
      description: "Fetch the current Aura project details.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "update_project",
      description: "Update the current Aura project's name, description, or commands.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          build_command: { type: "string" },
          test_command: { type: "string" },
        },
      },
    },
    {
      name: "get_project_stats",
      description: "Fetch aggregate metrics for the current Aura project.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "start_dev_loop",
      description: "Start the Aura autonomous dev loop for the current project agent.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "pause_dev_loop",
      description: "Pause the Aura autonomous dev loop for the current project agent.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "stop_dev_loop",
      description: "Stop the Aura autonomous dev loop for the current project agent.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "get_loop_status",
      description: "Fetch the Aura dev-loop status for the current project agent.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await (async () => {
      switch (name) {
        case "list_specs":
          return listSpecs();
        case "get_spec":
          return getSpec(args ?? {});
        case "create_spec":
          return createSpec(args ?? {});
        case "update_spec":
          return updateSpec(args ?? {});
        case "delete_spec":
          return deleteSpec(args ?? {});
        case "list_tasks":
          return listTasks(args ?? {});
        case "get_task":
          return getTask(args ?? {});
        case "create_task":
          return createTask(args ?? {});
        case "update_task":
          return updateTask(args ?? {});
        case "delete_task":
          return deleteTask(args ?? {});
        case "transition_task":
          return transitionTask(args ?? {});
        case "retry_task":
          return retryTask(args ?? {});
        case "run_task":
          return runTask(args ?? {});
        case "get_project":
          return getProject();
        case "update_project":
          return updateProject(args ?? {});
        case "get_project_stats":
          return getProjectStats();
        case "start_dev_loop":
          return startDevLoop();
        case "pause_dev_loop":
          return pauseDevLoop();
        case "stop_dev_loop":
          return stopDevLoop();
        case "get_loop_status":
          return getLoopStatus();
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    })();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
