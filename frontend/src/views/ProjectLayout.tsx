import { useEffect, useState } from "react";
import { useParams, useNavigate, Outlet } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../types";
import { useProjectRegister } from "../context/ProjectContext";
import { PageEmptyState, Spinner } from "@cypher-asi/zui";

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const { register, unregister } = useProjectRegister();

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    return () => unregister();
  }, [unregister]);

  useEffect(() => {
    if (!project) return;

    const handleArchive = async () => {
      try {
        const updated = await api.archiveProject(project.project_id);
        setProject(updated);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to archive");
      }
    };

    const navigateToExecution = () => {
      navigate(`/projects/${project.project_id}/execution`);
    };

    register({
      project,
      setProject,
      message,
      handleArchive,
      navigateToExecution,
    });
  }, [project, message, navigate, register]);

  if (loading) return <Spinner />;
  if (!project) {
    return <PageEmptyState title="Project not found" />;
  }

  return <Outlet />;
}
