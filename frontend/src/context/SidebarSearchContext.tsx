import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAppContext } from "./AppContext";

interface SidebarSearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  action: ReactNode;
  setAction: (node: ReactNode) => void;
}

const SidebarSearchCtx = createContext<SidebarSearchContextValue>({
  query: "",
  setQuery: () => {},
  action: null,
  setAction: () => {},
});

export function SidebarSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQueryRaw] = useState("");
  const [action, setActionRaw] = useState<ReactNode>(null);
  const { activeApp } = useAppContext();

  useEffect(() => {
    setQueryRaw("");
  }, [activeApp.id]);

  const setQuery = useCallback((q: string) => setQueryRaw(q), []);
  const setAction = useCallback((node: ReactNode) => setActionRaw(node), []);

  return (
    <SidebarSearchCtx.Provider value={{ query, setQuery, action, setAction }}>
      {children}
    </SidebarSearchCtx.Provider>
  );
}

export function useSidebarSearch() {
  return useContext(SidebarSearchCtx);
}
