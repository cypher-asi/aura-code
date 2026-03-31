import { Monitor } from "lucide-react";
import type { ReactNode } from "react";
import type { AuraApp } from "../types";

function EmptyPanel() {
  return null;
}

function MainPanel({ children }: { children?: ReactNode }) {
  return children ?? null;
}

export const DesktopApp: AuraApp = {
  id: "desktop",
  label: "Desktop",
  icon: Monitor,
  basePath: "/desktop",
  LeftPanel: EmptyPanel,
  MainPanel,
};
