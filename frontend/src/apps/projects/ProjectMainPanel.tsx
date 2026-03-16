import { Outlet } from "react-router-dom";
import { Text } from "@cypher-asi/zui";
import { Lane } from "../../components/Lane";
import { ConnectionDot } from "../../components/ConnectionDot";
import { TerminalPanelHeader, TerminalPanelBody } from "../../components/TerminalPanel";
import { TerminalPanelProvider } from "../../context/TerminalPanelContext";
import { useProjectContext } from "../../context/ProjectContext";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";

export function ProjectMainPanel() {
  const ctx = useProjectContext();
  const cwd = ctx?.project?.linked_folder_path;
  const { supportsDesktopWorkspace } = useAuraCapabilities();

  if (!supportsDesktopWorkspace) {
    return (
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-3)",
            borderLeft: "1px solid var(--color-border)",
            borderBottom: "1px solid var(--color-border)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <ConnectionDot />
          <Text size="sm" weight="medium">
            {ctx?.project?.name ?? "Aura Companion"}
          </Text>
        </div>
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <TerminalPanelProvider cwd={cwd}>
      <Lane
        flex
        style={{ borderLeft: "1px solid var(--color-border)" }}
        taskbar={
          <div style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "stretch" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingLeft: "var(--space-3)",
                paddingRight: "var(--space-2)",
                flexShrink: 0,
              }}
            >
              <ConnectionDot />
            </div>
            <TerminalPanelHeader />
          </div>
        }
        footer={<TerminalPanelBody />}
      >
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Outlet />
        </main>
      </Lane>
    </TerminalPanelProvider>
  );
}
