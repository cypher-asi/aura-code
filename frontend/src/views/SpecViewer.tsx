import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { api } from "../api/client";
import type { Spec } from "../types";
import { Spinner } from "../components/Spinner";
import styles from "./views.module.css";

export function SpecViewer() {
  const { projectId, specId } = useParams<{ projectId: string; specId: string }>();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !specId) return;
    api
      .getSpec(projectId, specId)
      .then(setSpec)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, specId]);

  if (loading) return <Spinner size={28} />;
  if (!spec) {
    return (
      <div className={styles.emptyState}>
        <h3>Spec not found</h3>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.viewHeader}>
        <Link to={`/projects/${projectId}/specs`} style={{ fontSize: 13, marginBottom: 8, display: "inline-block" }}>
          &larr; Back to specs
        </Link>
        <h1 className={styles.viewTitle}>
          <span style={{ color: "var(--color-text-dim)", marginRight: 8 }}>
            #{spec.order_index + 1}
          </span>
          {spec.title}
        </h1>
      </div>
      <div className={`${styles.card} ${styles.markdown}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {spec.markdown_contents}
        </ReactMarkdown>
      </div>
    </div>
  );
}
