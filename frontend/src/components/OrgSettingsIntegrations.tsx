import { Input, Button } from "@cypher-asi/zui";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { OrgGithub, GitHubIntegration } from "../types";
import styles from "./OrgSettingsPanel.module.css";

interface Props {
  github: OrgGithub | null;
  githubOrg: string;
  onGithubOrgChange: (value: string) => void;
  githubIntegrations: GitHubIntegration[];
  isAdminOrOwner: boolean;
  saving: boolean;
  installLoading: boolean;
  onStartInstall: () => void;
  onRefreshIntegrations: () => void;
  onRefreshIntegration: (integrationId: string) => void;
  onRemoveIntegration: (integrationId: string) => void;
  onConnectGithub: () => void;
  onDisconnectGithub: () => void;
}

export function OrgSettingsIntegrations({
  github,
  githubOrg,
  onGithubOrgChange,
  githubIntegrations,
  isAdminOrOwner,
  saving,
  installLoading,
  onStartInstall,
  onRefreshIntegrations,
  onRefreshIntegration,
  onRemoveIntegration,
  onConnectGithub,
  onDisconnectGithub,
}: Props) {
  return (
    <>
      <h2 className={styles.sectionTitle}>Integrations</h2>

      <div className={styles.settingsGroupLabel}>GitHub App</div>
      <div className={styles.settingsGroup}>
        {isAdminOrOwner && (
          <div className={styles.inviteActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={onStartInstall}
              disabled={installLoading}
              icon={<ExternalLink size={14} />}
            >
              {installLoading ? "Opening..." : "Add GitHub Integration"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onRefreshIntegrations} icon={<RefreshCw size={14} />}>
              Refresh
            </Button>
          </div>
        )}

        {githubIntegrations.map((integration) => (
          <div key={integration.integration_id} className={styles.settingsRow}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>{integration.github_account_login}</span>
              <span className={styles.rowDescription}>
                {integration.github_account_type} &middot; {integration.repo_count} repos &middot; Connected{" "}
                {new Date(integration.connected_at).toLocaleDateString()}
              </span>
            </div>
            <div className={styles.rowControl}>
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={14} />}
                iconOnly
                aria-label="Refresh repos"
                onClick={() => onRefreshIntegration(integration.integration_id)}
              />
              {isAdminOrOwner && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onRemoveIntegration(integration.integration_id)}
                >
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        ))}

        {githubIntegrations.length === 0 && (
          <div className={styles.emptyMessage}>No GitHub integrations connected</div>
        )}
      </div>

      <div className={styles.settingsGroupLabel} style={{ marginTop: "var(--space-4)" }}>
        GitHub (Legacy)
      </div>
      <div className={styles.settingsGroup}>
        {github ? (
          <div className={styles.settingsRow}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>GitHub Organization</span>
              <span className={styles.rowDescription}>
                Connected to <strong>{github.github_org}</strong>
              </span>
            </div>
            <div className={styles.rowControl}>
              {isAdminOrOwner && (
                <Button variant="danger" size="sm" onClick={onDisconnectGithub}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.settingsRow}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>GitHub Organization</span>
              <span className={styles.rowDescription}>
                Connect a GitHub org manually (text-only, no API access)
              </span>
            </div>
            {isAdminOrOwner && (
              <div className={styles.rowControl}>
                <Input
                  size="sm"
                  value={githubOrg}
                  onChange={(e) => onGithubOrgChange(e.target.value)}
                  placeholder="org-name"
                  style={{ width: 160 }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onConnectGithub}
                  disabled={saving || !githubOrg.trim()}
                >
                  Connect
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
