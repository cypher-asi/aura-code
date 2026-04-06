import { useState, useEffect } from "react";
import { Text, Badge, Button } from "@cypher-asi/zui";
import {
  Bot,
  Calendar,
  Monitor,
  Cloud,
  KeyRound,
  Zap,
} from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import { FollowEditButton } from "../../../components/FollowEditButton";
import { api } from "../../../api/client";
import {
  formatAdapterLabel,
  formatAuthSourceLabel,
  formatRunsOnLabel,
  type RuntimeReadiness,
} from "./agent-info-utils";
import type { Agent, HarnessSkillInstallation } from "../../../types";
import styles from "./AgentInfoPanel.module.css";

export interface ProfileTabProps {
  agent: Agent;
  isOwnAgent: boolean;
  runtimeTesting: boolean;
  runtimeTestMessage: string | null;
  runtimeTestDetails: string | null;
  runtimeTestStatus: "success" | "error" | null;
  onRuntimeTest: () => void;
  runtimeResultRef: React.RefObject<HTMLDivElement | null>;
  runtimeReadiness: RuntimeReadiness;
}

function ProfileImage({ agent }: { agent: Agent }) {
  const [broken, setBroken] = useState(false);
  const showCover = !!agent.icon && !broken;

  if (showCover) {
    return (
      <div className={styles.profileCover}>
        <img
          src={agent.icon!}
          alt={agent.name}
          className={styles.profileCoverImage}
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div className={styles.profileImageBlock}>
      <Avatar avatarUrl={undefined} name={agent.name} type="agent" size={80} />
    </div>
  );
}

function ProfileHeader({
  agent,
  isOwnAgent,
}: Pick<ProfileTabProps, "agent" | "isOwnAgent">) {
  return (
    <>
      <ProfileImage agent={agent} />

      <div className={styles.nameBlock}>
        <div className={styles.nameText}>
          <span className={styles.displayName}>{agent.name}</span>
          {agent.role && <span className={styles.subtitle}>{agent.role}</span>}
        </div>
        {!isOwnAgent && (
          <div className={styles.nameAction}>
            <FollowEditButton isOwner={false} targetProfileId={agent.profile_id} />
          </div>
        )}
      </div>

      {agent.tags?.includes("super_agent") && (
        <div className={styles.section}>
          <Badge variant="running">CEO SuperAgent</Badge>
        </div>
      )}

      {agent.personality && (
        <div className={styles.section}>
          <Text size="xs" variant="muted" weight="medium">Personality</Text>
          <Text size="sm">{agent.personality}</Text>
        </div>
      )}
    </>
  );
}

function ProfileMetaGrid({ agent }: { agent: Agent }) {
  return (
    <div className={styles.metaGrid}>
      <div className={styles.metaRow}>
        {agent.machine_type === "remote" ? (
          <Cloud size={13} className={styles.metaIcon} />
        ) : (
          <Monitor size={13} className={styles.metaIcon} />
        )}
        <div className={styles.metaText}>
          <span className={styles.metaLabel}>Runs On</span>
          <span className={styles.metaValue}>
            {formatRunsOnLabel(agent.environment, agent.machine_type)}
          </span>
        </div>
      </div>
      <div className={styles.metaRow}>
        <Bot size={13} className={styles.metaIcon} />
        <div className={styles.metaText}>
          <span className={styles.metaLabel}>Agent Type</span>
          <span className={styles.metaValue}>{formatAdapterLabel(agent.adapter_type)}</span>
        </div>
      </div>
      <div className={styles.metaRow}>
        <KeyRound size={13} className={styles.metaIcon} />
        <div className={styles.metaText}>
          <span className={styles.metaLabel}>Credentials</span>
          <span className={styles.metaValue}>
            {formatAuthSourceLabel(agent.auth_source, agent.adapter_type)}
          </span>
        </div>
      </div>
      <div className={styles.metaRow}>
        <Calendar size={13} className={styles.metaIcon} />
        <div className={styles.metaText}>
          <span className={styles.metaLabel}>Birthed</span>
          <span className={styles.metaValue}>
            {new Date(agent.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>
    </div>
  );
}

function RuntimeSection({
  runtimeReadiness,
  runtimeTesting,
  runtimeTestMessage,
  runtimeTestDetails,
  runtimeTestStatus,
  onRuntimeTest,
  runtimeResultRef,
}: {
  runtimeReadiness: RuntimeReadiness;
  runtimeTesting: boolean;
  runtimeTestMessage: string | null;
  runtimeTestDetails: string | null;
  runtimeTestStatus: "success" | "error" | null;
  onRuntimeTest: () => void;
  runtimeResultRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const readinessClass =
    runtimeReadiness.tone === "success"
      ? styles.runtimeReadinessSuccess
      : runtimeReadiness.tone === "warning"
        ? styles.runtimeReadinessWarning
        : styles.runtimeReadinessInfo;
  const shouldShowReadiness = runtimeReadiness.tone === "warning" || showDetails;
  const hasExtraDetails = !!runtimeReadiness.message || !!runtimeTestDetails;

  return (
    <div className={styles.section}>
      <Text size="xs" variant="muted" weight="medium">Runtime Tools</Text>
      <div className={styles.runtimeToolbar}>
        <div className={styles.runtimeToolbarActions}>
          <Button variant="secondary" size="sm" onClick={onRuntimeTest} disabled={runtimeTesting}>
            {runtimeTesting ? "Checking..." : "Check Runtime"}
          </Button>
          <span
            className={`${styles.runtimeStatusBadge} ${
              runtimeReadiness.tone === "success"
                ? styles.runtimeStatusSuccess
                : runtimeReadiness.tone === "warning"
                  ? styles.runtimeStatusWarning
                  : styles.runtimeStatusInfo
            }`}
          >
            {runtimeReadiness.label}
          </span>
        </div>
        {hasExtraDetails && (
          <button
            type="button"
            className={styles.inlineAction}
            onClick={() => setShowDetails((current) => !current)}
          >
            {showDetails ? "Hide details" : "Runtime details"}
          </button>
        )}
      </div>
      {shouldShowReadiness && (
        <div className={`${styles.runtimeReadiness} ${readinessClass}`}>
          <Text size="xs" weight="medium" className={styles.runtimeReadinessTitle}>
            {runtimeReadiness.title}
          </Text>
          <Text size="xs" variant="muted">{runtimeReadiness.message}</Text>
        </div>
      )}
      {runtimeTestMessage && (
        <RuntimeTestResult
          runtimeResultRef={runtimeResultRef}
          runtimeTestStatus={runtimeTestStatus}
          runtimeTestMessage={runtimeTestMessage}
          runtimeTestDetails={runtimeTestDetails}
          collapsed={!showDetails && runtimeTestStatus !== "error"}
        />
      )}
    </div>
  );
}

function RuntimeTestResult({
  runtimeResultRef,
  runtimeTestStatus,
  runtimeTestMessage,
  runtimeTestDetails,
  collapsed,
}: {
  runtimeResultRef: React.RefObject<HTMLDivElement | null>;
  runtimeTestStatus: "success" | "error" | null;
  runtimeTestMessage: string;
  runtimeTestDetails: string | null;
  collapsed: boolean;
}) {
  return (
    <div
      ref={runtimeResultRef}
      className={`${styles.runtimeTestResult} ${
        runtimeTestStatus === "error" ? styles.runtimeTestError : styles.runtimeTestSuccess
      }`}
      aria-live="polite"
    >
      <Text size="xs" weight="medium" className={styles.runtimeTestTitle}>
        {runtimeTestStatus === "error" ? "Runtime check failed" : "Runtime ready"}
      </Text>
      <Text size="xs" variant="muted">{runtimeTestMessage}</Text>
      {runtimeTestDetails && !collapsed && (
        <Text size="xs" variant="muted" className={styles.runtimeTestMeta}>
          {runtimeTestDetails}
        </Text>
      )}
    </div>
  );
}

export function ProfileTab(props: ProfileTabProps) {
  const { agent } = props;
  const [installations, setInstallations] = useState<HarnessSkillInstallation[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.harnessSkills
      .listAgentSkills(agent.agent_id)
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result)
          ? result
          : (result as any)?.skills ?? (result as any)?.installations ?? [];
        setInstallations(list);
      })
      .catch(() => {
        if (!cancelled) setInstallations([]);
      });
    return () => { cancelled = true; };
  }, [agent.agent_id]);

  return (
    <>
      <ProfileHeader
        agent={agent}
        isOwnAgent={props.isOwnAgent}
      />
      <ProfileMetaGrid agent={agent} />
      <RuntimeSection
        runtimeReadiness={props.runtimeReadiness}
        runtimeTesting={props.runtimeTesting}
        runtimeTestMessage={props.runtimeTestMessage}
        runtimeTestDetails={props.runtimeTestDetails}
        runtimeTestStatus={props.runtimeTestStatus}
        onRuntimeTest={props.onRuntimeTest}
        runtimeResultRef={props.runtimeResultRef}
      />
      {installations.length > 0 && (
        <div className={styles.skillTagsSection}>
          {installations.map((inst) => (
            <span key={inst.skill_name} className={styles.skillTag}>
              <Zap size={10} className={styles.skillTagIcon} />
              {inst.skill_name}
            </span>
          ))}
        </div>
      )}
      {agent.system_prompt && (
        <div className={styles.section}>
          <Text size="xs" variant="muted" weight="medium">System Prompt</Text>
          <Text size="sm" className={styles.prompt}>{agent.system_prompt}</Text>
        </div>
      )}
    </>
  );
}
