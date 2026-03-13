import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SidekickContextValue {
  isOpen: boolean;
  title: string;
  content: ReactNode;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setTitle: (title: string) => void;
  setContent: (content: ReactNode) => void;
}

const SidekickContext = createContext<SidekickContextValue | null>(null);

export function SidekickProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<ReactNode>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <SidekickContext.Provider
      value={{ isOpen, title, content, open, close, toggle, setTitle, setContent }}
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
