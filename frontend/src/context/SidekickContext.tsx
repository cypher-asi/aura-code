import { createContext, useContext, useCallback, useState, type ReactNode } from "react";
import type { Spec } from "../types";

type SidekickTab = "specs" | "tasks" | "progress";

interface PanelState {
  activeTab: SidekickTab;
  selectedSpec: Spec | null;
  infoContent: ReactNode;
  showInfo: boolean;
  refreshKey: number;
}

interface PanelActions {
  setActiveTab: (tab: SidekickTab) => void;
  viewSpec: (spec: Spec) => void;
  clearSpec: () => void;
  toggleInfo: (title: string, content: ReactNode) => void;
  triggerRefresh: () => void;
}

type SidekickContextValue = PanelState & PanelActions;

const INITIAL_PANEL: PanelState = {
  activeTab: "specs",
  selectedSpec: null,
  infoContent: null,
  showInfo: false,
  refreshKey: 0,
};

const SidekickContext = createContext<SidekickContextValue | null>(null);

export function SidekickProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = useState<PanelState>(INITIAL_PANEL);

  const setActiveTab = useCallback((tab: SidekickTab) => {
    setPanel((prev) => ({ ...prev, activeTab: tab, selectedSpec: null, showInfo: false }));
  }, []);

  const viewSpec = useCallback((spec: Spec) => {
    setPanel((prev) => ({ ...prev, selectedSpec: spec, showInfo: false }));
  }, []);

  const clearSpec = useCallback(() => {
    setPanel((prev) => ({ ...prev, selectedSpec: null }));
  }, []);

  const toggleInfo = useCallback((_title: string, content: ReactNode) => {
    setPanel((prev) => {
      if (prev.showInfo) {
        return { ...prev, showInfo: false, infoContent: null };
      }
      return { ...prev, showInfo: true, infoContent: content };
    });
  }, []);

  const triggerRefresh = useCallback(() => {
    setPanel((prev) => ({ ...prev, refreshKey: prev.refreshKey + 1 }));
  }, []);

  return (
    <SidekickContext.Provider
      value={{
        ...panel,
        setActiveTab,
        viewSpec,
        clearSpec,
        toggleInfo,
        triggerRefresh,
      }}
    >
      {children}
    </SidekickContext.Provider>
  );
}

export function useSidekick(): SidekickContextValue {
  const ctx = useContext(SidekickContext);
  if (!ctx) {
    throw new Error("useSidekick must be used within a SidekickProvider");
  }
  return ctx;
}
