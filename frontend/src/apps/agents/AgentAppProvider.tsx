import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAgentStore } from "./stores";

export function AgentAppProvider({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    useAgentStore.getState().fetchAgents();
  }, []);
  return <>{children}</>;
}
