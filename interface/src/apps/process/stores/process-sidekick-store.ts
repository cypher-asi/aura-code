import { create } from "zustand";
import type { ProcessRun } from "../../../types";

export type ProcessSidekickTab = "process" | "runs" | "events" | "stats" | "log";

interface ProcessSidekickState {
  activeTab: ProcessSidekickTab;
  previewRun: ProcessRun | null;
  showEditor: boolean;
  showDeleteConfirm: boolean;

  setActiveTab: (tab: ProcessSidekickTab) => void;
  viewRun: (run: ProcessRun) => void;
  closePreview: () => void;
  requestEdit: () => void;
  requestDelete: () => void;
  closeEditor: () => void;
  closeDeleteConfirm: () => void;
}

export const useProcessSidekickStore = create<ProcessSidekickState>()((set) => ({
  activeTab: "process",
  previewRun: null,
  showEditor: false,
  showDeleteConfirm: false,

  setActiveTab: (tab) => set({ activeTab: tab, previewRun: null }),
  viewRun: (run) => set({ previewRun: run }),
  closePreview: () => set({ previewRun: null }),
  requestEdit: () => set({ showEditor: true }),
  requestDelete: () => set({ showDeleteConfirm: true }),
  closeEditor: () => set({ showEditor: false }),
  closeDeleteConfirm: () => set({ showDeleteConfirm: false }),
}));
