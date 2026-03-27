import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { AgentInstance, ProjectId } from "../types";

export type TerminalModeStatus = "loading" | "ready" | "error";

export interface ProjectTerminalMode {
  remoteAgentId: string | undefined;
  status: TerminalModeStatus;
}

/**
 * Resolves whether a project should use a remote agent terminal or a local one.
 *
 * Returns `status: "ready"` only after the check completes so callers can gate
 * side-effects (like `setRemoteAgentId`) and avoid acting on stale / transient
 * values.  While a re-fetch is in-flight for the *same* project the previous
 * resolved value is preserved, preventing unnecessary terminal resets.
 */
export function useProjectTerminalMode(projectId: ProjectId | undefined): ProjectTerminalMode {
  const [state, setState] = useState<ProjectTerminalMode>({
    remoteAgentId: undefined,
    status: "loading",
  });

  const lastResolvedProjectId = useRef<ProjectId | undefined>(undefined);

  useEffect(() => {
    if (!projectId) {
      lastResolvedProjectId.current = undefined;
      setState({ remoteAgentId: undefined, status: "ready" });
      return;
    }

    const isSameProject = lastResolvedProjectId.current === projectId;
    if (!isSameProject) {
      setState((prev) => ({ ...prev, status: "loading" }));
    }

    let cancelled = false;

    api
      .listAgentInstances(projectId)
      .then((instances: AgentInstance[]) => {
        if (cancelled) return;
        const remote = instances.find((i) => i.machine_type === "remote");
        lastResolvedProjectId.current = projectId;
        setState({ remoteAgentId: remote?.agent_id, status: "ready" });
      })
      .catch(() => {
        if (cancelled) return;
        lastResolvedProjectId.current = projectId;
        setState({ remoteAgentId: undefined, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return state;
}
