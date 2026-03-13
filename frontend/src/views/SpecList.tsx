import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Spec } from "../types";
import { Page, PageEmptyState, Item, Text } from "@cypher-asi/zui";
import { FileText } from "lucide-react";

export function SpecList() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
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

  return (
    <Page title="Specs" subtitle={`${specs.length} spec files`} isLoading={loading}>
      {specs.length === 0 ? (
        <PageEmptyState
          icon={<FileText size={32} />}
          title="No specs generated"
          description='Go to the project page and click "Generate Specs" to create them.'
        />
      ) : (
        specs.map((spec) => (
          <Item
            key={spec.spec_id}
            onClick={() => navigate(`/projects/${projectId}/specs/${spec.spec_id}`)}
          >
            <Item.Icon>
              <Text variant="muted" size="xs" as="span">{spec.order_index + 1}</Text>
            </Item.Icon>
            <Item.Label>{spec.title}</Item.Label>
          </Item>
        ))
      )}
    </Page>
  );
}
