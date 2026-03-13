import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../types";
import { Item, ButtonPlus, Group, Text } from "@cypher-asi/zui";
import { Circle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  planning: "var(--color-accent)",
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
          projects.map((p) => (
            <Item
              key={p.project_id}
              selected={p.project_id === projectId}
              onClick={() => navigate(`/projects/${p.project_id}`)}
            >
              <Item.Icon>
                <Circle
                  size={8}
                  fill={STATUS_COLORS[p.current_status] || "var(--status-pending)"}
                  stroke="none"
                />
              </Item.Icon>
              <Item.Label>{p.name}</Item.Label>
            </Item>
          ))
        )}
      </Group>
    </div>
  );
}
