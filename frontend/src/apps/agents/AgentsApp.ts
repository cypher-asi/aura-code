import { Brain } from "lucide-react";
import { AgentList } from "./AgentList";
import { AgentMainPanel } from "./AgentMainPanel";
import { AgentsResponsiveControls } from "./AgentsResponsiveControls";
import { AgentInfoPanel } from "./AgentInfoPanel";
import { AgentAppProvider } from "./AgentAppProvider";
import type { AuraApp } from "../types";

export const AgentsApp: AuraApp = {
  id: "agents",
  label: "Agents",
  icon: Brain,
  basePath: "/agents",
  LeftPanel: AgentList,
  MainPanel: AgentMainPanel,
  ResponsiveControls: AgentsResponsiveControls,
  SidekickPanel: AgentInfoPanel,
  Provider: AgentAppProvider,
  searchPlaceholder: "Search Agents...",
};
