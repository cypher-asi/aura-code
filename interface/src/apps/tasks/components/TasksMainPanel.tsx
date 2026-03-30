import { useParams } from "react-router-dom";
import { EmptyState } from "../../../components/EmptyState";

export function TasksMainPanel({ children }: { children?: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return (
      <EmptyState>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <strong>Select a project to view tasks</strong>
        </div>
      </EmptyState>
    );
  }

  return <>{children}</>;
}
