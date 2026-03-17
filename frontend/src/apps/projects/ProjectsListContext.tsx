import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { api } from "../../api/client";
import { useOrg } from "../../context/OrgContext";
import type { Project } from "../../types";

interface ProjectsListContextValue {
  projects: Project[];
  loadingProjects: boolean;
  setProjects: Dispatch<SetStateAction<Project[]>>;
  refreshProjects: () => Promise<void>;
  recentProjects: Project[];
  mostRecentProject: Project | null;
}

const ProjectsListContext = createContext<ProjectsListContextValue | null>(null);

export function ProjectsListProvider({ children }: { children: ReactNode }) {
  const { activeOrg } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const nextProjects = await api.listProjects(activeOrg?.org_id);
      setProjects(nextProjects);
    } catch (error) {
      console.error("Failed to load projects", error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [activeOrg?.org_id]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const recentProjects = useMemo(
    () => [...projects]
      .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
      .slice(0, 3),
    [projects],
  );

  const mostRecentProject = useMemo(
    () => recentProjects[0] ?? null,
    [recentProjects],
  );

  const value = useMemo<ProjectsListContextValue>(
    () => ({
      projects,
      loadingProjects,
      setProjects,
      refreshProjects,
      recentProjects,
      mostRecentProject,
    }),
    [projects, loadingProjects, refreshProjects, recentProjects, mostRecentProject],
  );

  return (
    <ProjectsListContext.Provider value={value}>
      {children}
    </ProjectsListContext.Provider>
  );
}

export function useProjectsList() {
  const context = useContext(ProjectsListContext);
  if (!context) {
    throw new Error("useProjectsList must be used within ProjectsListProvider");
  }
  return context;
}
