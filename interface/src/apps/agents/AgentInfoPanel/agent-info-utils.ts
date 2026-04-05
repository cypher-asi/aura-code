import type { Agent, Session } from "../../../types";

export interface RuntimeReadiness {
  tone: "info" | "success" | "warning";
  title: string;
  message: string;
}

export type AnnotatedSession = Session & {
  _projectName: string;
  _projectId: string;
  _agentInstanceId: string;
};

export function formatAdapterLabel(adapterType?: string | null): string {
  switch (adapterType) {
    case "claude_code":
      return "Claude Code";
    case "codex":
      return "Codex";
    case "aura_harness":
    default:
      return "Aura";
  }
}

export function formatAuthSourceLabel(authSource?: string | null): string {
  switch (authSource) {
    case "org_integration":
      return "Team Integration";
    case "local_cli_auth":
      return "Local Login";
    case "aura_managed":
    default:
      return "Aura Billing";
  }
}

export function formatRunsOnLabel(
  environment?: string | null,
  machineType?: string | null,
): string {
  const effective =
    environment || (machineType === "remote" ? "swarm_microvm" : "local_host");
  switch (effective) {
    case "swarm_microvm":
      return "Isolated Cloud Runtime";
    case "local_host":
    default:
      return "This Machine";
  }
}

export function describeRuntimeReadiness(
  agent: Agent,
  integration?: { name: string; has_secret: boolean } | null,
): RuntimeReadiness {
  if (agent.auth_source === "org_integration") {
    if (!integration) {
      return {
        tone: "warning",
        title: "Team integration missing",
        message:
          "This agent expects a team integration, but none is currently attached. Attach one before running the agent.",
      };
    }
    if (!integration.has_secret) {
      return {
        tone: "warning",
        title: "Integration missing a key",
        message: `${integration.name} is attached, but it does not have a stored key yet. Add one in Integrations before running this agent.`,
      };
    }
    return {
      tone: "success",
      title: "Team integration ready",
      message: `${integration.name} has a stored key. Keys stay at the org integration layer and are resolved only at runtime.`,
    };
  }

  if (agent.auth_source === "local_cli_auth") {
    const runtimeName =
      agent.adapter_type === "claude_code" ? "Claude Code" : "Codex";
    return {
      tone: "info",
      title: "Uses a local login",
      message: `${runtimeName} uses the CLI login available to aura-os-server on this machine. Check Runtime verifies that the CLI is installed and logged in.`,
    };
  }

  return {
    tone: "success",
    title: "Uses Aura billing",
    message:
      "Aura Billing is managed by Aura. Check Runtime verifies the live runtime path for this agent.",
  };
}

export function formatDuration(
  startedAt: string,
  endedAt: string | null,
): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffSec = Math.floor((end - start) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  const sec = diffSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}
