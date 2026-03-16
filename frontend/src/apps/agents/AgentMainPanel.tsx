import { Outlet } from "react-router-dom";
import { Lane } from "../../components/Lane";
import { ConnectionDot } from "../../components/ConnectionDot";

export function AgentMainPanel() {
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
