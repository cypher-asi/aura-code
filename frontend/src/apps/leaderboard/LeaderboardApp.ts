import { Gem } from "lucide-react";
import { LeaderboardSidebar } from "./LeaderboardSidebar";
import { LeaderboardMainPanel } from "./LeaderboardMainPanel";
import { LeaderboardSidekickPanel } from "./LeaderboardSidekickPanel";
import { LeaderboardProvider, useLeaderboardSidekickCollapsed } from "./LeaderboardContext";
import type { AuraApp } from "../types";

export const LeaderboardApp: AuraApp = {
  id: "leaderboard",
  label: "Leaderboard",
  icon: Gem,
  basePath: "/leaderboard",
  LeftPanel: LeaderboardSidebar,
  MainPanel: LeaderboardMainPanel,
  SidekickPanel: LeaderboardSidekickPanel,
  useSidekickCollapsed: useLeaderboardSidekickCollapsed,
  Provider: LeaderboardProvider,
};
