import { useState, useEffect, useCallback } from "react";
import { Modal, Button, Input, Spinner, Text } from "@cypher-asi/zui";
import { api } from "../api/client";
import type { Project, AgentInstance } from "../types";
import styles from "./ProjectList.module.css";

interface DeleteProjectModalProps {
  target: Project | null;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteProjectModal({ target, loading, onClose, onDelete }: DeleteProjectModalProps) {
  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="Delete Project"
      size="sm"
      footer={
        <div className={styles.confirmFooter}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onDelete} disabled={loading} className={styles.dangerButton}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      }
    >
      <div className={styles.confirmMessage}>
        Are you sure you want to delete &ldquo;{target?.name}&rdquo;? This action cannot be undone.
      </div>
    </Modal>
  );
}

interface DeleteAgentInstanceModalProps {
  target: AgentInstance | null;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteAgentInstanceModal({ target, loading, onClose, onDelete }: DeleteAgentInstanceModalProps) {
  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="Remove Agent"
      size="sm"
      footer={
        <div className={styles.confirmFooter}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onDelete} disabled={loading} className={styles.dangerButton}>
            {loading ? "Removing..." : "Remove"}
          </Button>
        </div>
      }
    >
      <div className={styles.confirmMessage}>
        Are you sure you want to remove &ldquo;{target?.name}&rdquo; and all its messages? This action cannot be undone.
      </div>
    </Modal>
  );
}

interface ProjectSettingsModalProps {
  target: Project | null;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

export function ProjectSettingsModal({ target, onClose, onSaved }: ProjectSettingsModalProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) {
      setProject(null);
      return;
    }
    setLoading(true);
    setError("");
    api
      .getProject(target.project_id)
      .then((p) => {
        setProject(p);
        setGitRepoUrl(p.git_repo_url ?? "");
        setGitBranch(p.git_branch ?? "main");
      })
      .catch(() => setError("Failed to load project"))
      .finally(() => setLoading(false));
  }, [target?.project_id]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateProject(project.project_id, {
        git_repo_url: gitRepoUrl.trim() || undefined,
        git_branch: gitBranch.trim() || undefined,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [project, gitRepoUrl, gitBranch, onSaved, onClose]);

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="Project settings"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? <><Spinner size="sm" /> Saving...</> : "Save"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div style={{ padding: "var(--space-4)" }}>
          <Spinner size="md" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Text variant="muted" size="sm" style={{ marginBottom: "var(--space-1)" }}>
            Git / Orbit
          </Text>
          <Input
            value={gitRepoUrl}
            onChange={(e) => setGitRepoUrl(e.target.value)}
            placeholder="Git remote URL"
          />
          <Input
            value={gitBranch}
            onChange={(e) => setGitBranch(e.target.value)}
            placeholder="Branch (e.g. main)"
          />
          {error && (
            <Text variant="muted" size="sm" style={{ color: "var(--color-danger)" }}>
              {error}
            </Text>
          )}
        </div>
      )}
    </Modal>
  );
}
