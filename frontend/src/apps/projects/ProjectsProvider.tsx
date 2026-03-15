import type { ReactNode } from "react";
import { SidekickProvider } from "../../context/SidekickContext";
import { ProjectContextProvider } from "../../context/ProjectContext";

export function ProjectsProvider({ children }: { children: ReactNode }) {
  return (
    <SidekickProvider>
      <ProjectContextProvider>
        {children}
      </ProjectContextProvider>
    </SidekickProvider>
  );
}
