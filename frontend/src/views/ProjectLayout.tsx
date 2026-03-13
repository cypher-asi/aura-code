import { useEffect, useState } from "react";
import { useParams, useNavigate, useMatch, Outlet } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../types";
import type { EngineEvent } from "../types/events";
import { useEventContext } from "../context/EventContext";
import { useSidekick } from "../context/SidekickContext";
import { StatusBadge } from "../components/StatusBadge";
import { PageEmptyState, Button, Spinner, Tabs, Text } from "@cypher-asi/zui";
import { Play, Archive, FileText, ListChecks, Info } from "lucide-react";
import styles from "./aura.module.css";

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const match = useMatch("/projects/:projectId/:tab/*");
  const activeTab = match?.params.tab ?? "specs";

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { subscribe } = useEventContext();
  const sidekick = useSidekick();

  useEffect(() => {
    const unsubs = [
      subscribe("spec_gen_completed", (e: EngineEvent) => {
        if (e.project_id === projectId) {
          setGenLoading(false);
        }
      }),
      subscribe("spec_gen_failed", (e: EngineEvent) => {
        if (e.project_id === projectId) {
          setGenLoading(false);
        }
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [projectId, subscribe]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Spinner />;
  if (!project) {
    return <PageEmptyState title="Project not found" />;
  }

  const handleGenerateSpecs = async () => {
    setGenLoading(true);
    setMessage("");
    sidekick.startStreaming("Generating Specs");
    await api.generateSpecsStream(project.project_id, {
      onProgress(stage) {
        sidekick.setStreamStage(stage);
      },
      onDelta(text) {
        sidekick.appendDelta(text);
      },
      onGenerating(tokens) {
        sidekick.setTokenCount(tokens);
      },
      onComplete(specs) {
        setMessage(`Generated ${specs.length} spec files`);
        setGenLoading(false);
        sidekick.finishStreaming();
        navigate(`/projects/${project.project_id}/specs`);
      },
      onError(msg) {
        setMessage(msg);
        setGenLoading(false);
        sidekick.finishStreaming();
      },
    });
  };

  const handleExtractTasks = async () => {
    setExtractLoading(true);
    setMessage("");
    try {
      const tasks = await api.extractTasks(project.project_id);
      setMessage(`Extracted ${tasks.length} tasks`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to extract tasks");
    } finally {
      setExtractLoading(false);
    }
  };

  const handleArchive = async () => {
    try {
      const updated = await api.archiveProject(project.project_id);
      setProject(updated);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to archive");
    }
  };

  return (
    <div>
      {message && <Text variant="secondary" size="sm" style={{ marginBottom: "var(--space-4)" }}>{message}</Text>}

      <Tabs
        tabs={[
          { id: "specs", label: "Specs" },
          { id: "tasks", label: "Tasks" },
          { id: "progress", label: "Progress" },
        ]}
        value={activeTab}
        onChange={(id) => navigate(`/projects/${project.project_id}/${id}`)}
      />

      <div style={{ marginTop: "var(--space-4)" }}>
        <Outlet context={{ project, setProject }} />
      </div>
    </div>
  );
}
