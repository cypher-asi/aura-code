import type { ReactNode } from "react";
import { ProjectsListProvider } from "./ProjectsListContext";

export function ProjectsProvider({ children }: { children: ReactNode }) {
  return (
    <ProjectsListProvider>
      {children}
    </ProjectsListProvider>
  );
}
