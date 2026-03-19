import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Tabs, Text } from "@cypher-asi/zui";
import { useProjectContext } from "../../context/ProjectContext";
import { useProjectsList } from "./useProjectsList";
import { ProjectList } from "../../components/ProjectList";
import styles from "../../components/ResponsivePanel.module.css";

const PROJECT_TABS = [
  { id: "chat", label: "Chat" },
  { id: "execution", label: "Execution" },
];

export function ProjectsResponsiveControls() {
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
  const selectedAgentId = agentInstanceId ?? agents[0]?.agent_instance_id ?? "";
  const hasChatTarget = Boolean(agentInstanceId) || loadingAgents || agents.length > 0;
  const selectedTab = isExecutionRoute ? "execution" : "chat";
  const tabs = hasChatTarget ? PROJECT_TABS : PROJECT_TABS.filter((tab) => tab.id === "execution");

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

  if (!projectId) {
    return (
      <section className={styles.panel}>
        <div className={styles.header}>
          <Text size="sm" weight="medium">Projects</Text>
          <Text size="sm" variant="muted" className={styles.meta}>
            Open a project without leaving this view.
          </Text>
        </div>
        <div className={styles.embeddedList}>
          <ProjectList />
        </div>
      </section>
    );
  }

  if (!project) {
    return null;
  }

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
    <section className={styles.panel}>
      <div className={styles.header}>
        <Text size="sm" weight="medium">{project.name}</Text>
        <Text size="sm" variant="muted" className={styles.meta}>
          {agents.length > 0 ? `${agents.length} agent${agents.length === 1 ? "" : "s"}` : "Execution"}
        </Text>
      </div>

      <div className={styles.controls}>
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
            onChange={(event) => navigate(`/projects/${projectId}/agents/${event.target.value}`)}
            className={styles.select}
            aria-label="Choose project agent"
          >
            {agents.map((agent) => (
              <option key={agent.agent_instance_id} value={agent.agent_instance_id}>
                {agent.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
}
