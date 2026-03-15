import { createContext, useContext, useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { TimePeriod } from "./mockData";

interface LeaderboardContextValue {
  period: TimePeriod;
  setPeriod: (p: TimePeriod) => void;
}

const LeaderboardCtx = createContext<LeaderboardContextValue | null>(null);

export function LeaderboardProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<TimePeriod>("all");

  const value = useMemo(() => ({ period, setPeriod }), [period]);

  return (
    <LeaderboardCtx.Provider value={value}>{children}</LeaderboardCtx.Provider>
  );
}

export function useLeaderboard() {
  const ctx = useContext(LeaderboardCtx);
  if (!ctx)
    throw new Error("useLeaderboard must be used within LeaderboardProvider");
  return ctx;
}
