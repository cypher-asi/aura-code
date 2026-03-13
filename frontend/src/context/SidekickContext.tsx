import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from "react";
import type { ChatSession, Spec, Task } from "../types";

type SidekickTab = "specs" | "tasks" | "progress";

interface PanelState {
  activeTab: SidekickTab;
  selectedSpec: Spec | null;
  infoContent: ReactNode;
  showInfo: boolean;
  specs: Spec[];
  tasks: Task[];
  streamingSessionId: string | null;
}

type SessionUpdateListener = (session: ChatSession) => void;

interface PanelActions {
  setActiveTab: (tab: SidekickTab) => void;
  viewSpec: (spec: Spec) => void;
  clearSpec: () => void;
  toggleInfo: (title: string, content: ReactNode) => void;
  pushSpec: (spec: Spec) => void;
  pushTask: (task: Task) => void;
  clearGeneratedArtifacts: () => void;
  setStreamingSessionId: (id: string | null) => void;
  notifySessionTitleUpdate: (session: ChatSession) => void;
  onSessionTitleUpdate: (listener: SessionUpdateListener) => () => void;
}

type SidekickContextValue = PanelState & PanelActions;

const INITIAL_PANEL: PanelState = {
  activeTab: "specs",
  selectedSpec: null,
  infoContent: null,
  showInfo: false,
  specs: [],
  tasks: [],
  streamingSessionId: null,
};

const SidekickContext = createContext<SidekickContextValue | null>(null);

export function SidekickProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = useState<PanelState>(INITIAL_PANEL);
  const titleListeners = useRef<Set<SessionUpdateListener>>(new Set());

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

  const pushSpec = useCallback((spec: Spec) => {
    setPanel((prev) => {
      const exists = prev.specs.some((s) => s.spec_id === spec.spec_id);
      const next = exists
        ? prev.specs.map((s) => (s.spec_id === spec.spec_id ? spec : s))
        : [...prev.specs, spec];
      return { ...prev, specs: next.sort((a, b) => a.order_index - b.order_index) };
    });
  }, []);

  const pushTask = useCallback((task: Task) => {
    setPanel((prev) => {
      const exists = prev.tasks.some((t) => t.task_id === task.task_id);
      const next = exists
        ? prev.tasks.map((t) => (t.task_id === task.task_id ? task : t))
        : [...prev.tasks, task];
      return { ...prev, tasks: next.sort((a, b) => a.order_index - b.order_index) };
    });
  }, []);

  const clearGeneratedArtifacts = useCallback(() => {
    setPanel((prev) => ({ ...prev, specs: [], tasks: [] }));
  }, []);

  const setStreamingSessionId = useCallback((id: string | null) => {
    setPanel((prev) => ({ ...prev, streamingSessionId: id }));
  }, []);

  const notifySessionTitleUpdate = useCallback((session: ChatSession) => {
    titleListeners.current.forEach((fn) => fn(session));
  }, []);

  const onSessionTitleUpdate = useCallback((listener: SessionUpdateListener) => {
    titleListeners.current.add(listener);
    return () => { titleListeners.current.delete(listener); };
  }, []);

  return (
    <SidekickContext.Provider
      value={{
        ...panel,
        setActiveTab,
        viewSpec,
        clearSpec,
        toggleInfo,
        pushSpec,
        pushTask,
        clearGeneratedArtifacts,
        setStreamingSessionId,
        notifySessionTitleUpdate,
        onSessionTitleUpdate,
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
