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
  const markdownContents = args?.markdownContents;
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

async function nextOrderIndex() {
  const specs = await api(`/api/projects/${projectId}/specs`);
  if (!Array.isArray(specs) || specs.length === 0) {
    return 0;
  }
  return Math.max(
    ...specs.map((spec) => (typeof spec?.order_index === "number" ? spec.order_index : 0)),
  ) + 1;
}

async function createSpec(args) {
  const title = normalizeTitle(args);
  const markdownContents = normalizeMarkdownContents(args);
  const orderIndex = await nextOrderIndex();
  return api(`/api/projects/${projectId}/specs`, {
    method: "POST",
    body: JSON.stringify({
      title,
      markdownContents,
      orderIndex,
    }),
  });
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
          markdownContents: {
            type: "string",
            description:
              "Full markdown body of the spec that should be saved into Aura OS.",
          },
        },
        required: ["title", "markdownContents"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "create_spec") {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
    };
  }

  try {
    const spec = await createSpec(args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(spec) }],
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
