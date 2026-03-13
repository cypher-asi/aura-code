import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Spec } from "../types";
import { Spinner } from "@cypher-asi/zui";
import styles from "./views.module.css";

export function SpecList() {
  const { projectId } = useParams<{ projectId: string }>();
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    api
      .listSpecs(projectId)
      .then((s) => setSpecs(s.sort((a, b) => a.order_index - b.order_index)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className={styles.viewHeader}>
        <h1 className={styles.viewTitle}>Specs</h1>
        <p className={styles.viewSubtitle}>{specs.length} spec files</p>
      </div>

      {specs.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No specs generated</h3>
          <p>Go to the project page and click "Generate Specs" to create them.</p>
        </div>
      ) : (
        specs.map((spec) => (
          <Link
            key={spec.spec_id}
            to={`/projects/${projectId}/specs/${spec.spec_id}`}
            className={styles.specItem}
          >
            <span className={styles.specOrder}>{spec.order_index + 1}</span>
            <span className={styles.specTitle}>{spec.title}</span>
          </Link>
        ))
      )}
    </div>
  );
}
