import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Rocket } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { getLastAgent } from "../utils/storage";
import { useOrg } from "../context/OrgContext";
import { api } from "../api/client";

export function HomeView() {
  const lastAgent = getLastAgent();
  const { activeOrg } = useOrg();
  const [projectCount, setProjectCount] = useState<number>(0);

  useEffect(() => {
    if (!activeOrg?.org_id) {
      setProjectCount(0);
      return;
    }
    api.listProjects(activeOrg.org_id).then((list) => setProjectCount(list.length)).catch(() => setProjectCount(0));
  }, [activeOrg?.org_id]);

  if (lastAgent) {
    return (
      <Navigate
        to={`/projects/${lastAgent.projectId}/agents/${lastAgent.agentInstanceId}`}
        replace
      />
    );
  }

  const message =
    projectCount === 0
      ? "Create a project to begin"
      : "Select a project from the sidebar or create a new one to get started.";

  return (
    <EmptyState icon={<Rocket size={32} />}>
      {message}
    </EmptyState>
  );
}
