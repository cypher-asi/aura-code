import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../types";
import styles from "./ProjectList.module.css";

const STATUS_COLORS: Record<string, string> = {
  planning: "var(--color-primary)",
  active: "var(--status-done)",
  paused: "var(--status-in-progress)",
  completed: "var(--status-done)",
  archived: "var(--status-pending)",
};

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { projectId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Projects</span>
        <button
          className={styles.newBtn}
          onClick={() => navigate("/new-project")}
          title="New Project"
        >
          +
        </button>
      </div>
      {projects.length === 0 ? (
        <div className={styles.empty}>No projects yet</div>
      ) : (
        <ul className={styles.list}>
          {projects.map((p) => (
            <li key={p.project_id}>
              <Link
                to={`/projects/${p.project_id}`}
                className={
                  p.project_id === projectId ? styles.itemActive : styles.item
                }
              >
                <span
                  className={styles.statusDot}
                  style={{ background: STATUS_COLORS[p.current_status] || "var(--status-pending)" }}
                />
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
