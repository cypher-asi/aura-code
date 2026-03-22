import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getLastAgent } from "../../utils/storage";
import { useProjectsList } from "../../apps/projects/useProjectsList";
import { projectAgentChatRoute } from "../../utils/mobileNavigation";
import { ProjectEmptyView } from "../ProjectEmptyView";
import type { AgentInstance } from "../../types";

function resolveAgentTarget(projectId: string, agents: AgentInstance[]): string | null {
  const lastAgentInstanceId = getLastAgent(projectId);
  if (lastAgentInstanceId) {
    const matching = agents.find((a) => a.agent_instance_id === lastAgentInstanceId);
    if (matching) return projectAgentChatRoute(projectId, matching.agent_instance_id);
  }
  if (agents.length > 0) {
    return projectAgentChatRoute(projectId, agents[0].agent_instance_id);
  }
  return null;
}

export function ProjectAgentRedirectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { agentsByProject, refreshProjectAgents } = useProjectsList();

  const cachedAgents = projectId ? agentsByProject[projectId] : undefined;

  useEffect(() => {
    if (!projectId || cachedAgents !== undefined) return;
    void refreshProjectAgents(projectId);
  }, [projectId, cachedAgents, refreshProjectAgents]);

  if (projectId && cachedAgents) {
    const target = resolveAgentTarget(projectId, cachedAgents);
    if (target) return <Navigate to={target} replace />;
    return <ProjectEmptyView mode="agent" />;
  }

  return null;
}
