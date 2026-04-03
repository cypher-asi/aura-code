import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useProcessStore, LAST_PROCESS_ID_KEY } from "../stores/process-store";

export function ProcessProvider({ children }: { children: ReactNode }) {
  const fetchProcesses = useProcessStore((s) => s.fetchProcesses);
  const fetchFolders = useProcessStore((s) => s.fetchFolders);
  const fetchNodes = useProcessStore((s) => s.fetchNodes);
  const fetchConnections = useProcessStore((s) => s.fetchConnections);
  const fetchRuns = useProcessStore((s) => s.fetchRuns);
  const { processId } = useParams<{ processId: string }>();

  useEffect(() => { fetchProcesses(); fetchFolders(); }, [fetchProcesses, fetchFolders]);

  useEffect(() => {
    if (processId) {
      localStorage.setItem(LAST_PROCESS_ID_KEY, processId);
      fetchNodes(processId);
      fetchConnections(processId);
      fetchRuns(processId);
    }
  }, [processId, fetchNodes, fetchConnections, fetchRuns]);

  return <>{children}</>;
}
