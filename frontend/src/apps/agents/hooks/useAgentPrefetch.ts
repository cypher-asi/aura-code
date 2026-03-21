import { useCallback } from "react";
import { useAgentStore } from "../stores";

const LAST_AGENT_KEY = "aura:lastAgentId";

export function useAgentPrefetch(): () => void {
  return useCallback(() => {
    const store = useAgentStore.getState();
    store.fetchAgents().catch(() => {});
    const lastId = localStorage.getItem(LAST_AGENT_KEY);
    if (lastId) {
      store.prefetchHistory(lastId);
    }
  }, []);
}
