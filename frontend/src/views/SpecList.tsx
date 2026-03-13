import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Spec } from "../types";
import type { EngineEvent } from "../types/events";
import { useEventContext } from "../context/EventContext";
import { useSidekick } from "../context/SidekickContext";
import { Page, PageEmptyState, Item, Text } from "@cypher-asi/zui";
import { FileText } from "lucide-react";

export function SpecList() {
  const { projectId } = useParams<{ projectId: string }>();
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { subscribe } = useEventContext();
  const sidekick = useSidekick();

  const fetchSpecs = useCallback(
    (autoSelect?: boolean) => {
      if (!projectId) return;
      api
        .listSpecs(projectId)
        .then((s) => {
          const sorted = s.sort((a, b) => a.order_index - b.order_index);
          setSpecs(sorted);
          if (autoSelect && sorted.length > 0) {
            setSelectedId(sorted[0].spec_id);
            sidekick.viewSpec(sorted[0]);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    },
    [projectId, sidekick],
  );

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  useEffect(() => {
    const unsub = subscribe("spec_gen_completed", (e: EngineEvent) => {
      if (e.project_id === projectId) {
        fetchSpecs(true);
      }
    });
    return unsub;
  }, [projectId, subscribe, fetchSpecs]);

  const handleSelect = (spec: Spec) => {
    setSelectedId(spec.spec_id);
    sidekick.viewSpec(spec);
  };

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
            selected={spec.spec_id === selectedId}
            onClick={() => handleSelect(spec)}
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
