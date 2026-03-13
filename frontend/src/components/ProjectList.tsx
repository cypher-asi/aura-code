import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../types";
import { Explorer, ButtonPlus, Group, Text } from "@cypher-asi/zui";
import type { ExplorerNode } from "@cypher-asi/zui";
import { FolderOpen } from "lucide-react";

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { projectId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error);
  }, []);

  const treeData: ExplorerNode[] = useMemo(
    () =>
      projects.map((p) => ({
        id: p.project_id,
        label: p.name,
        icon: <FolderOpen size={14} />,
        children: [],
      })),
    [projects],
  );

  const handleSelect = (selectedIds: string[]) => {
    const id = selectedIds[0];
    if (id) {
      navigate(`/projects/${id}`);
    }
  };

  return (
    <div>
      <Group
        label="Projects"
        stats={<ButtonPlus onClick={() => navigate("/new-project")} size="sm" title="New Project" />}
      >
        {projects.length === 0 ? (
          <Text variant="muted" size="sm" style={{ padding: "var(--space-3) var(--space-4)" }}>
            No projects yet
          </Text>
        ) : (
          <Explorer
            data={treeData}
            onSelect={handleSelect}
            defaultSelectedIds={projectId ? [projectId] : []}
            enableDragDrop={false}
            enableMultiSelect={false}
            compact
          />
        )}
      </Group>
    </div>
  );
}
