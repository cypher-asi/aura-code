import { PageEmptyState } from "@cypher-asi/zui";
import { Rocket } from "lucide-react";
import { useOrg } from "../context/OrgContext";

export function HomeView() {
  const { activeOrg, isLoading } = useOrg();

  return (
    <PageEmptyState
      icon={<Rocket size={32} />}
      title="Welcome to AURA"
      description={
        activeOrg
          ? "Select a project from navigation to get started."
          : isLoading
            ? "Loading your workspace..."
            : "Create or join a team to start your first project."
      }
    />
  );
}
