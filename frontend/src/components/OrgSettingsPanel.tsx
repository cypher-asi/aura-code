import { useState, useEffect, useCallback, useRef } from "react";
import { useOrg } from "../context/OrgContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { Modal, Navigator, Button, Input, Text } from "@cypher-asi/zui";
import type { NavigatorItemProps } from "@cypher-asi/zui";
import { Copy, Trash2, UserMinus, Settings, Users, Mail, CreditCard, Plug } from "lucide-react";
import type { OrgInvite, OrgGithub, OrgBilling, OrgRole } from "../types";
import styles from "./OrgSettingsPanel.module.css";

type Section = "general" | "members" | "invites" | "billing" | "integrations";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: NavigatorItemProps[] = [
  { id: "general", label: "General", icon: <Settings size={14} /> },
  { id: "members", label: "Members", icon: <Users size={14} /> },
  { id: "invites", label: "Invites", icon: <Mail size={14} /> },
  { id: "billing", label: "Billing", icon: <CreditCard size={14} /> },
  { id: "integrations", label: "Integrations", icon: <Plug size={14} /> },
];

export function OrgSettingsPanel({ isOpen, onClose }: Props) {
  const { activeOrg, renameOrg, members, refreshMembers, refreshOrgs } = useOrg();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("general");

  // General
  const [teamName, setTeamName] = useState(activeOrg?.name ?? "");
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamMessage, setTeamMessage] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Invites / Billing / GitHub
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [billing, setBilling] = useState<OrgBilling | null>(null);
  const [github, setGithub] = useState<OrgGithub | null>(null);
  const [billingEmail, setBillingEmail] = useState("");
  const [githubOrg, setGithubOrg] = useState("");
  const [saving, setSaving] = useState(false);

  const orgId = activeOrg?.org_id;
  const myRole = members.find((m) => m.user_id === user?.user_id)?.role;
  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  useEffect(() => {
    setTeamName(activeOrg?.name ?? "");
  }, [activeOrg?.org_id]);

  const handleTeamNameChange = (value: string) => {
    setTeamName(value);
    setTeamMessage("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!activeOrg || !value.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setTeamSaving(true);
      try {
        await renameOrg(activeOrg.org_id, value.trim());
        setTeamMessage("Saved");
      } catch (err) {
        setTeamMessage(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setTeamSaving(false);
      }
    }, 500);
  };

  const loadInvites = useCallback(async () => {
    if (!orgId) return;
    try {
      setInvites(await api.orgs.listInvites(orgId));
    } catch { /* ignore */ }
  }, [orgId]);

  const loadBilling = useCallback(async () => {
    if (!orgId) return;
    try {
      const b = await api.orgs.getBilling(orgId);
      setBilling(b);
      setBillingEmail(b?.billing_email ?? "");
    } catch { /* ignore */ }
  }, [orgId]);

  const loadGithub = useCallback(async () => {
    if (!orgId) return;
    try {
      const g = await api.orgs.getGithub(orgId);
      setGithub(g);
      setGithubOrg(g?.github_org ?? "");
    } catch { /* ignore */ }
  }, [orgId]);

  useEffect(() => {
    if (!isOpen || !orgId) return;
    refreshMembers();
    loadInvites();
    loadBilling();
    loadGithub();
  }, [isOpen, orgId, refreshMembers, loadInvites, loadBilling, loadGithub]);

  const handleCreateInvite = async () => {
    if (!orgId) return;
    try {
      await api.orgs.createInvite(orgId);
      loadInvites();
    } catch (err) {
      console.error("Failed to create invite", err);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!orgId) return;
    try {
      await api.orgs.revokeInvite(orgId, inviteId);
      loadInvites();
    } catch (err) {
      console.error("Failed to revoke invite", err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!orgId) return;
    try {
      await api.orgs.removeMember(orgId, userId);
      refreshMembers();
    } catch (err) {
      console.error("Failed to remove member", err);
    }
  };

  const handleRoleChange = async (userId: string, role: OrgRole) => {
    if (!orgId) return;
    try {
      await api.orgs.updateMemberRole(orgId, userId, role);
      refreshMembers();
      refreshOrgs();
    } catch (err) {
      console.error("Failed to change role", err);
    }
  };

  const handleSaveBilling = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await api.orgs.setBilling(orgId, billingEmail || null, billing?.plan ?? "free");
      loadBilling();
    } catch (err) {
      console.error("Failed to save billing", err);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGithub = async () => {
    if (!orgId || !githubOrg.trim()) return;
    setSaving(true);
    try {
      await api.orgs.setGithub(orgId, githubOrg.trim());
      loadGithub();
    } catch (err) {
      console.error("Failed to connect GitHub", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!orgId) return;
    try {
      await api.orgs.removeGithub(orgId);
      setGithub(null);
      setGithubOrg("");
    } catch (err) {
      console.error("Failed to disconnect GitHub", err);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
  };

  if (!activeOrg) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Team Settings" size="full" noPadding fullHeight>
      <div className={styles.settingsLayout}>
        {/* ── Left sidebar ── */}
        <div className={styles.settingsNav}>
          <div className={styles.navHeader}>
            <h3>{activeOrg.name}</h3>
            <span>Team settings</span>
          </div>
          <Navigator
            items={NAV_ITEMS}
            value={section}
            onChange={(id) => setSection(id as Section)}
          />
        </div>

        {/* ── Content area ── */}
        <div className={styles.settingsContent}>
          {section === "general" && (
            <>
              <h2 className={styles.sectionTitle}>General</h2>

              <div className={styles.settingsGroupLabel}>Team</div>
              <div className={styles.settingsGroup}>
                <div className={styles.settingsRow}>
                  <div className={styles.rowInfo}>
                    <span className={styles.rowLabel}>Team Name</span>
                    <span className={styles.rowDescription}>
                      The display name for your team
                    </span>
                  </div>
                  <div className={styles.rowControl}>
                    <Input
                      size="sm"
                      value={teamName}
                      onChange={(e) => handleTeamNameChange(e.target.value)}
                      placeholder="My Team"
                      style={{ width: 200 }}
                    />
                  </div>
                </div>
              </div>
              {(teamSaving || teamMessage) && (
                <Text variant="muted" size="sm" style={{ marginTop: "var(--space-2)" }}>
                  {teamSaving ? "Saving..." : teamMessage}
                </Text>
              )}
            </>
          )}

          {section === "members" && (
            <>
              <h2 className={styles.sectionTitle}>Members</h2>

              <div className={styles.settingsGroupLabel}>
                Team Members ({members.length})
              </div>
              <div className={styles.settingsGroup}>
                {members.map((m) => (
                  <div key={m.user_id} className={styles.memberRow}>
                    <span className={styles.memberName}>{m.display_name}</span>
                    {myRole === "owner" && m.user_id !== user?.user_id ? (
                      <select
                        className={styles.roleSelect}
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as OrgRole)}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      <span className={styles.roleBadge}>{m.role}</span>
                    )}
                    {isAdminOrOwner && m.role !== "owner" && m.user_id !== user?.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<UserMinus size={14} />}
                        iconOnly
                        aria-label="Remove member"
                        onClick={() => handleRemoveMember(m.user_id)}
                      />
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <div className={styles.emptyMessage}>No members yet</div>
                )}
              </div>
            </>
          )}

          {section === "invites" && (
            <>
              <h2 className={styles.sectionTitle}>Invites</h2>

              <div className={styles.settingsGroupLabel}>Invite Links</div>
              <div className={styles.settingsGroup}>
                {isAdminOrOwner && (
                  <div className={styles.inviteActions}>
                    <Button variant="primary" size="sm" onClick={handleCreateInvite}>
                      Generate Invite Link
                    </Button>
                  </div>
                )}
                {invites
                  .filter((i) => i.status === "pending")
                  .map((inv) => (
                    <div key={inv.invite_id} className={styles.inviteRow}>
                      <code className={styles.inviteToken}>
                        {`${window.location.origin}/invite/${inv.token}`}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Copy size={14} />}
                        iconOnly
                        aria-label="Copy link"
                        onClick={() => copyInviteLink(inv.token)}
                      />
                      {isAdminOrOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          iconOnly
                          aria-label="Revoke"
                          onClick={() => handleRevokeInvite(inv.invite_id)}
                        />
                      )}
                    </div>
                  ))}
                {invites.filter((i) => i.status === "pending").length === 0 && (
                  <div className={styles.emptyMessage}>No pending invites</div>
                )}
              </div>
            </>
          )}

          {section === "billing" && (
            <>
              <h2 className={styles.sectionTitle}>Billing</h2>

              <div className={styles.settingsGroupLabel}>Plan</div>
              <div className={styles.settingsGroup}>
                <div className={styles.settingsRow}>
                  <div className={styles.rowInfo}>
                    <span className={styles.rowLabel}>Current Plan</span>
                    <span className={styles.rowDescription}>
                      Your team's active subscription
                    </span>
                  </div>
                  <div className={styles.rowControl}>
                    <span className={styles.roleBadge}>{billing?.plan ?? "free"}</span>
                  </div>
                </div>
                {isAdminOrOwner && (
                  <div className={styles.settingsRow}>
                    <div className={styles.rowInfo}>
                      <span className={styles.rowLabel}>Billing Email</span>
                      <span className={styles.rowDescription}>
                        Invoices and receipts will be sent here
                      </span>
                    </div>
                    <div className={styles.rowControl}>
                      <Input
                        size="sm"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        placeholder="billing@example.com"
                        style={{ width: 200 }}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveBilling}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {section === "integrations" && (
            <>
              <h2 className={styles.sectionTitle}>Integrations</h2>

              <div className={styles.settingsGroupLabel}>GitHub</div>
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
                        <Button variant="danger" size="sm" onClick={handleDisconnectGithub}>
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
                        Connect a GitHub org to enable repository access
                      </span>
                    </div>
                    {isAdminOrOwner && (
                      <div className={styles.rowControl}>
                        <Input
                          size="sm"
                          value={githubOrg}
                          onChange={(e) => setGithubOrg(e.target.value)}
                          placeholder="org-name"
                          style={{ width: 160 }}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleConnectGithub}
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
          )}
        </div>
      </div>
    </Modal>
  );
}
