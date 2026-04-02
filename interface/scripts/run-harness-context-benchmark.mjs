import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const interfaceRoot = process.cwd();
const resultsDir = path.resolve(interfaceRoot, process.env.AURA_EVAL_RESULTS_DIR ?? "test-results");
const harnessBaseUrl = process.env.AURA_EVAL_HARNESS_URL?.trim() || "http://127.0.0.1:3404";
const harnessWsUrl = `${harnessBaseUrl.replace(/^http/, "ws")}/stream`;
const accessToken = process.env.AURA_EVAL_ACCESS_TOKEN?.trim() || "";
const device = process.env.AURA_EVAL_SCENARIO_DEVICE?.trim() || "local";
const scenarioId = process.env.AURA_EVAL_SCENARIO_ID?.trim() || "harness-context-static-site";
const title = process.env.AURA_EVAL_SCENARIO_TITLE?.trim() || "Harness Context Static Site";
const verbose = process.env.AURA_EVAL_VERBOSE === "1";

const prompts = [
  "Inspect this small static site project and summarize its current structure. Read the important files first. Do not change any code in this turn.",
  "Implement a stronger landing page. Update the hero copy, add a short three-item features section, and keep the styling simple and clean.",
  "Refine the page without starting over. Add a compact footer, make the CTA copy consistent with the hero, and keep the files tidy.",
  "Summarize exactly which files you changed and the user-visible improvements you made.",
];

function logStep(message, details) {
  if (!verbose) return;
  if (details === undefined) {
    process.stderr.write(`[harness-benchmark] ${message}\n`);
    return;
  }
  process.stderr.write(`[harness-benchmark] ${message} ${JSON.stringify(details)}\n`);
}

function toJsonMessage(type, payload = {}) {
  return JSON.stringify({ type, ...payload });
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function readUsage(message) {
  const usage = asRecord(message.usage);
  if (!usage) return null;
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens: Number(usage.cache_creation_input_tokens ?? 0),
    cacheReadInputTokens: Number(usage.cache_read_input_tokens ?? 0),
    estimatedContextTokens: Number(usage.estimated_context_tokens ?? 0),
    contextUtilization: Number(usage.context_utilization ?? 0),
    model: typeof usage.model === "string" ? usage.model : null,
    provider: typeof usage.provider === "string" ? usage.provider : null,
  };
}

function countFilesChanged(message) {
  const filesChanged = asRecord(message.files_changed);
  if (!filesChanged) return 0;
  return ["created", "modified", "deleted"].reduce((count, key) => {
    const value = filesChanged[key];
    return count + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function summarizeTurns(turns) {
  const models = new Set();
  const providers = new Set();

  const totals = turns.reduce((acc, turn) => {
    const usage = turn.usage;
    if (!usage) return acc;
    if (usage.model) models.add(usage.model);
    if (usage.provider) providers.add(usage.provider);

    acc.totalInputTokens += usage.inputTokens;
    acc.totalOutputTokens += usage.outputTokens;
    acc.totalCacheCreationInputTokens += usage.cacheCreationInputTokens;
    acc.totalCacheReadInputTokens += usage.cacheReadInputTokens;
    acc.promptInputFootprintTokens +=
      usage.inputTokens + usage.cacheCreationInputTokens + usage.cacheReadInputTokens;
    acc.maxEstimatedContextTokens = Math.max(
      acc.maxEstimatedContextTokens,
      usage.estimatedContextTokens,
    );
    acc.maxContextUtilization = Math.max(
      acc.maxContextUtilization,
      usage.contextUtilization,
    );
    acc.fileChangeCount += turn.fileChangeCount;
    return acc;
  }, {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationInputTokens: 0,
    totalCacheReadInputTokens: 0,
    promptInputFootprintTokens: 0,
    maxEstimatedContextTokens: 0,
    maxContextUtilization: 0,
    fileChangeCount: 0,
  });

  return {
    ...totals,
    totalTokens: totals.totalInputTokens + totals.totalOutputTokens,
    richUsageSessions: 1,
    fallbackUsageSessions: 0,
    richUsageTurns: turns.filter((turn) => turn.usage).length,
    fallbackUsageTurns: 0,
    estimatedCostUsd: 0,
    models: Array.from(models).sort(),
    providers: Array.from(providers).sort(),
    legacyVisibleInputTokens: totals.totalInputTokens,
    legacyTelemetryGapTokens:
      totals.totalCacheCreationInputTokens + totals.totalCacheReadInputTokens,
  };
}

async function createWorkspace(rootDir) {
  await fs.mkdir(rootDir, { recursive: true });

  const files = new Map([
    ["package.json", JSON.stringify({
      name: "harness-context-static-site",
      private: true,
      version: "0.0.1",
      scripts: {
        test: "echo \"no tests\"",
      },
    }, null, 2)],
    ["index.html", `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aura Starter</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <p class="eyebrow">Aura Starter</p>
        <h1>Ship a clean demo fast.</h1>
        <p class="lede">A tiny static site that is intentionally plain so the coding agent has room to improve it.</p>
        <a class="cta" href="#details">Learn more</a>
      </section>
    </main>
  </body>
</html>
`],
    ["styles.css", `:root {
  color-scheme: light;
  font-family: "Helvetica Neue", Arial, sans-serif;
  color: #14213d;
  background: #f6f7fb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 48px 20px;
}

.hero {
  max-width: 720px;
  background: white;
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(20, 33, 61, 0.08);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 12px;
  color: #5c677d;
}

.hero h1 {
  margin: 12px 0;
  font-size: 48px;
  line-height: 1.05;
}

.lede {
  font-size: 18px;
  line-height: 1.6;
}

.cta {
  display: inline-block;
  margin-top: 20px;
  padding: 14px 22px;
  border-radius: 999px;
  background: #14213d;
  color: white;
  text-decoration: none;
}
`],
    ["requirements.md", `# Requirements

- Turn this into a better-looking small landing page.
- Keep it as a static site.
- Do not add build tooling.
- Keep the structure easy to understand.
`],
  ]);

  await Promise.all([...files.entries()].map(([relativePath, content]) =>
    fs.writeFile(path.join(rootDir, relativePath), content, "utf8")
  ));
}

function openHarnessSession() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(harnessWsUrl);
    const state = {
      socket,
      sessionReady: false,
      pendingTurn: null,
      turns: [],
    };

    socket.addEventListener("open", () => resolve(state));
    socket.addEventListener("error", (event) => reject(event.error ?? new Error("WebSocket error")));
  });
}

async function waitForSessionReady(state, workspacePath) {
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === "session_ready") {
        state.sessionReady = true;
        state.socket.removeEventListener("message", onMessage);
        resolve(message);
      } else if (message.type === "error") {
        state.socket.removeEventListener("message", onMessage);
        reject(new Error(message.message ?? "session init failed"));
      }
    };

    state.socket.addEventListener("message", onMessage);
    state.socket.send(toJsonMessage("session_init", {
      project_path: workspacePath,
      max_turns: 16,
      token: accessToken || undefined,
    }));
  });
}

async function runTurn(state, prompt, turnIndex) {
  return new Promise((resolve, reject) => {
    const turn = {
      turnIndex,
      prompt,
      text: "",
      toolNames: [],
      usage: null,
      fileChangeCount: 0,
      rawEnd: null,
    };

    const onMessage = (event) => {
      const message = JSON.parse(String(event.data));
      switch (message.type) {
        case "text_delta":
          turn.text += message.text ?? "";
          break;
        case "tool_use_start":
          if (typeof message.name === "string") {
            turn.toolNames.push(message.name);
          }
          break;
        case "assistant_message_end":
          turn.rawEnd = message;
          turn.usage = readUsage(message);
          turn.fileChangeCount = countFilesChanged(message);
          state.socket.removeEventListener("message", onMessage);
          resolve(turn);
          break;
        case "error":
          state.socket.removeEventListener("message", onMessage);
          reject(new Error(message.message ?? "turn failed"));
          break;
        default:
          break;
      }
    };

    state.socket.addEventListener("message", onMessage);
    state.socket.send(toJsonMessage("user_message", {
      content: prompt,
    }));
  });
}

async function main() {
  await fs.mkdir(resultsDir, { recursive: true });

  const runId = `${scenarioId}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const workspaceDir = path.join(os.tmpdir(), runId);
  await createWorkspace(workspaceDir);
  logStep("workspace prepared", { workspaceDir, harnessBaseUrl });

  const session = await openHarnessSession();
  try {
    await waitForSessionReady(session, workspaceDir);
    logStep("session ready");

    const turns = [];
    for (const [index, prompt] of prompts.entries()) {
      logStep("turn start", { turn: index + 1 });
      const turn = await runTurn(session, prompt, index + 1);
      turns.push(turn);
      logStep("turn complete", {
        turn: index + 1,
        tools: turn.toolNames,
        usage: turn.usage,
        fileChangeCount: turn.fileChangeCount,
      });
    }

    const metrics = summarizeTurns(turns);
    const payload = {
      suite: "benchmark",
      scenarioId,
      title,
      device,
      generatedAt: new Date().toISOString(),
      counts: {
        doneTasks: 1,
        failedTasks: 0,
      },
      metrics,
      turns,
      workspaceDir,
      harnessBaseUrl,
    };

    const outputPath = path.join(resultsDir, `${runId}.json`);
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
    process.stdout.write(`${outputPath}\n`);
  } finally {
    session.socket.close();
    await fs.rm(workspaceDir, { recursive: true, force: true });
  }
}

await main();
