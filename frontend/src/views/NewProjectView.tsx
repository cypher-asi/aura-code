import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Spinner } from "@cypher-asi/zui";
import styles from "./views.module.css";

export function NewProjectView() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [reqPath, setReqPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        linked_folder_path: folderPath.trim(),
        requirements_doc_path: reqPath.trim(),
      });
      navigate(`/projects/${project.project_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.viewHeader}>
        <h1 className={styles.viewTitle}>New Project</h1>
        <p className={styles.viewSubtitle}>Create a new project to start building</p>
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div className={styles.card}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Project Name *</label>
            <input
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <textarea
              className={styles.formTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Linked Folder Path</label>
            <input
              className={styles.formInput}
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="/path/to/your/codebase"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Requirements Doc Path</label>
            <input
              className={styles.formInput}
              value={reqPath}
              onChange={(e) => setReqPath(e.target.value)}
              placeholder="/path/to/requirements.md"
            />
          </div>
          {error && <p className={styles.errorText}>{error}</p>}
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? <><Spinner size="sm" /> Creating...</> : "Create Project"}
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => navigate("/")}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
