import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Tabs, Text } from "@cypher-asi/zui";
import { Lane } from "../../components/Lane";
import { ConnectionDot } from "../../components/ConnectionDot";
import { TerminalPanelHeader, TerminalPanelBody } from "../../components/TerminalPanel";
import { TerminalPanelProvider } from "../../context/TerminalPanelContext";
import { useProjectContext } from "../../context/ProjectContext";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";
import { useProjectsList } from "./useProjectsList";

const MOBILE_PROJECT_TABS = [
  { id: "chat", label: "Chat" },
  { id: "execution", label: "Execution" },
];

function MobileProjectHeader() {
  const ctx = useProjectContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, agentInstanceId } = useParams();
  const { agentsByProject, loadingAgentsByProject, refreshProjectAgents } = useProjectsList();

  const project = ctx?.project;
  const isExecutionRoute = location.pathname.endsWith("/execution");
  const agents = useMemo(
    () => (projectId ? agentsByProject[projectId] ?? [] : []),
    [agentsByProject, projectId],
  );
  const loadingAgents = projectId ? loadingAgentsByProject[projectId] ?? !(projectId in agentsByProject) : false;
  const hasChatTarget = Boolean(agentInstanceId) || loadingAgents || agents.length > 0;
  const selectedTab = isExecutionRoute ? "execution" : "chat";
  const selectedAgentId = agentInstanceId ?? agents[0]?.agent_instance_id ?? "";

  useEffect(() => {
    if (!projectId) return;
    if (!(projectId in agentsByProject)) {
      void refreshProjectAgents(projectId);
    }
  }, [agentsByProject, projectId, refreshProjectAgents]);

  useEffect(() => {
    if (!projectId || isExecutionRoute || agentInstanceId || loadingAgents) return;

    if (agents.length > 0) {
      navigate(`/projects/${projectId}/agents/${agents[0].agent_instance_id}`, { replace: true });
      return;
    }

    navigate(`/projects/${projectId}/execution`, { replace: true });
  }, [agentInstanceId, agents, isExecutionRoute, loadingAgents, navigate, projectId]);

  const tabs = hasChatTarget ? MOBILE_PROJECT_TABS : MOBILE_PROJECT_TABS.filter((tab) => tab.id === "execution");

  const navigateToChat = () => {
    if (!projectId) return;

    if (selectedAgentId) {
      navigate(`/projects/${projectId}/agents/${selectedAgentId}`);
      return;
    }

    refreshProjectAgents(projectId)
      .then((next) => {
        if (next.length > 0) {
          navigate(`/projects/${projectId}/agents/${next[0].agent_instance_id}`);
          return;
        }
        navigate(`/projects/${projectId}/execution`);
      })
      .catch(() => {
        navigate(`/projects/${projectId}/execution`);
      });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        borderLeft: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
        <ConnectionDot />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Text size="sm" weight="medium" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {project?.name ?? "Aura Companion"}
          </Text>
          <Text variant="muted" size="xs">
            {agents.length > 0 ? `${agents.length} agent${agents.length === 1 ? "" : "s"}` : "Execution companion"}
          </Text>
        </div>
      </div>

      <Tabs
        key={tabs.map((tab) => tab.id).join(":")}
        tabs={tabs}
        value={selectedTab}
        onChange={(tabId) => {
          if (!projectId) return;
          if (tabId === "execution") {
            navigate(`/projects/${projectId}/execution`);
            return;
          }
          navigateToChat();
        }}
        size="sm"
      />

      {agents.length > 1 && !isExecutionRoute && (
        <select
          value={selectedAgentId}
          onChange={(event) => {
            if (!projectId) return;
            navigate(`/projects/${projectId}/agents/${event.target.value}`);
          }}
          style={{
            width: "100%",
            background: "var(--color-bg-tertiary, #2a2a2a)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            color: "inherit",
            fontSize: 13,
            padding: "8px 10px",
          }}
        >
          {agents.map((agent) => (
            <option key={agent.agent_instance_id} value={agent.agent_instance_id}>
              {agent.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function ProjectMainPanel() {
  const ctx = useProjectContext();
  const { projectId } = useParams();
  const cwd = ctx?.project?.linked_folder_path;
  const { isMobileLayout } = useAuraCapabilities();
  const showMobileProjectHeader = Boolean(projectId && ctx?.project);

  if (isMobileLayout) {
    return (
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {showMobileProjectHeader && <MobileProjectHeader />}
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
