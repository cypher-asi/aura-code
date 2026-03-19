import { Outlet } from "react-router-dom";
import { Lane } from "../../components/Lane";
import { ConnectionDot } from "../../components/ConnectionDot";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";

export function AgentMainPanel() {
  const { isMobileLayout } = useAuraCapabilities();

  if (isMobileLayout) {
    return (
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
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
        </div>
      }
    >
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <Outlet />
      </main>
    </Lane>
  );
}
