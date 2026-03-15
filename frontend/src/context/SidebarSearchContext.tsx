import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAppContext } from "./AppContext";

interface SidebarSearchContextValue {
  query: string;
  setQuery: (q: string) => void;
}

const SidebarSearchCtx = createContext<SidebarSearchContextValue>({
  query: "",
  setQuery: () => {},
});

export function SidebarSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQueryRaw] = useState("");
  const { activeApp } = useAppContext();

  useEffect(() => {
    setQueryRaw("");
  }, [activeApp.id]);

  const setQuery = useCallback((q: string) => setQueryRaw(q), []);

  return (
    <SidebarSearchCtx.Provider value={{ query, setQuery }}>
      {children}
    </SidebarSearchCtx.Provider>
  );
}

export function useSidebarSearch() {
  return useContext(SidebarSearchCtx);
}
