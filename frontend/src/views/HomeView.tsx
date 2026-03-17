import { Navigate } from "react-router-dom";
import { PageEmptyState } from "@cypher-asi/zui";
import { Rocket } from "lucide-react";
import { getLastAgent } from "../utils/storage";
import { useAuraCapabilities } from "../hooks/use-aura-capabilities";
import { ProjectList } from "../components/ProjectList";

export function HomeView() {
  const lastAgent = getLastAgent();
  const { isMobileLayout } = useAuraCapabilities();

  if (lastAgent) {
    return (
      <Navigate
        to={`/projects/${lastAgent.projectId}/agents/${lastAgent.agentInstanceId}`}
        replace
      />
    );
  }

  if (isMobileLayout) {
    return <ProjectList />;
  }

  return (
    <PageEmptyState
      icon={<Rocket size={32} />}
      title="Welcome to AURA"
      description="Select a project from navigation or create a new one to get started."
    />
  );
}
