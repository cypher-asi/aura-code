import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { Spinner } from "../components/Spinner";
import styles from "./views.module.css";

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Spinner size={28} />;
  if (!project) {
    return (
      <div className={styles.emptyState}>
        <h3>Project not found</h3>
      </div>
    );
  }

  const handleGenerateSpecs = async () => {
    setGenLoading(true);
    setMessage("");
    try {
      const specs = await api.generateSpecs(project.project_id);
      setMessage(`Generated ${specs.length} spec files`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to generate specs");
    } finally {
      setGenLoading(false);
    }
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
      <div className={styles.viewHeader}>
        <h1 className={styles.viewTitle}>{project.name}</h1>
        <p className={styles.viewSubtitle}>{project.description}</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 20 }}>
        <div className={styles.infoGrid}>
          <span className={styles.infoLabel}>Status</span>
          <span><StatusBadge status={project.current_status} /></span>
          <span className={styles.infoLabel}>Folder</span>
          <span className={styles.infoValue}>{project.linked_folder_path || "—"}</span>
          <span className={styles.infoLabel}>Requirements</span>
          <span className={styles.infoValue}>{project.requirements_doc_path || "—"}</span>
          <span className={styles.infoLabel}>Created</span>
          <span className={styles.infoValue}>{new Date(project.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className={styles.actions} style={{ marginBottom: 20 }}>
        <button
          className={styles.btnPrimary}
          onClick={handleGenerateSpecs}
          disabled={genLoading}
        >
          {genLoading ? <><Spinner size={14} /> Generating...</> : "Generate Specs"}
        </button>
        <button
          className={styles.btnPrimary}
          onClick={handleExtractTasks}
          disabled={extractLoading}
        >
          {extractLoading ? <><Spinner size={14} /> Extracting...</> : "Extract Tasks"}
        </button>
        <button
          className={styles.btnSuccess}
          onClick={() => navigate(`/projects/${project.project_id}/execution`)}
        >
          Start Dev Loop
        </button>
        {project.current_status !== "archived" && (
          <button className={styles.btnDanger} onClick={handleArchive}>
            Archive
          </button>
        )}
      </div>

      {message && <p className={styles.successText}>{message}</p>}

      <div className={styles.tabs}>
        <Link to={`/projects/${project.project_id}/specs`} className={styles.tab}>
          Specs
        </Link>
        <Link to={`/projects/${project.project_id}/tasks`} className={styles.tab}>
          Tasks
        </Link>
        <Link to={`/projects/${project.project_id}/progress`} className={styles.tab}>
          Progress
        </Link>
      </div>
    </div>
  );
}
