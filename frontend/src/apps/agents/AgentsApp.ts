import { Brain } from "lucide-react";
import { AgentList } from "./AgentList";
import { AgentMainPanel } from "./AgentMainPanel";
import { AgentInfoPanel } from "./AgentInfoPanel";
import { AgentAppProvider } from "./AgentAppProvider";
import { useAgentStore } from "./stores";
import type { AuraApp } from "../types";

const LAST_AGENT_KEY = "aura:lastAgentId";

export const AgentsApp: AuraApp = {
  id: "agents",
  label: "Agents",
  icon: Brain,
  basePath: "/agents",
  LeftPanel: AgentList,
  MainPanel: AgentMainPanel,
  ResponsiveControls: AgentList,
  SidekickPanel: AgentInfoPanel,
  Provider: AgentAppProvider,
  searchPlaceholder: "Search Agents...",
  onPrefetch: () => {
    const store = useAgentStore.getState();
    store.fetchAgents().catch(() => {});
    const lastId = localStorage.getItem(LAST_AGENT_KEY);
    if (lastId) store.prefetchHistory(lastId);
  },
};
