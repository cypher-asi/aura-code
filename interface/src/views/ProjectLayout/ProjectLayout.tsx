import { Loader2, FolderGit2, SearchX } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { EmptyState } from "../../components/EmptyState";
import { PageEmptyState, Button } from "@cypher-asi/zui";
import { useDelayedLoading } from "../../hooks/use-delayed-loading";
import { useProjectLayoutData } from "./useProjectLayoutData";

export function ProjectLayout() {
  const navigate = useNavigate();
  const { displayProject, loading, projects } = useProjectLayoutData();
  const showSpinner = useDelayedLoading(loading && !displayProject);

  if (showSpinner) {
    return (
      <EmptyState>
        <Loader2 size={20} className="spin" />
      </EmptyState>
    );
  }
  if (!displayProject) {
    if (projects.length === 0) {
      return (
        <PageEmptyState
          icon={<FolderGit2 size={32} />}
          title="No project selected"
          description="Create a project to get started."
        />
      );
    }

    return (
      <PageEmptyState
        icon={<SearchX size={32} />}
        title="Project not found"
        description="Choose a project from navigation to continue."
        actions={
          <Button variant="secondary" onClick={() => navigate("/projects")}>
            Back to Projects
          </Button>
        }
      />
    );
  }

  return (
    <ErrorBoundary name="project-view">
      <Outlet />
    </ErrorBoundary>
  );
}
