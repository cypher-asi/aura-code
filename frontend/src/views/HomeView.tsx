import { PageEmptyState } from "@cypher-asi/zui";
import { Rocket } from "lucide-react";

export function HomeView() {
  return (
    <PageEmptyState
      icon={<Rocket size={32} />}
      title="Welcome to AURA"
      description="Select a project from navigation or create a new one to get started."
    />
  );
}
