import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Text, Button, Input, Badge } from "@cypher-asi/zui";
import { Save, Bot, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import type { Agent } from "../../types";
import { useAgentApp } from "./AgentAppProvider";
import styles from "./AgentDetailView.module.css";

export function AgentDetailView() {
  const { agentId } = useParams<{ agentId: string }>();
  const { refresh, selectAgent } = useAgentApp();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const load = useCallback(() => {
    if (!agentId) return;
    setLoading(true);
    api.agents.get(agentId as never).then((a) => {
      setAgent(a);
      selectAgent(a);
      setName(a.name);
      setRole(a.role);
      setPersonality(a.personality);
      setSystemPrompt(a.system_prompt);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [agentId, selectAgent]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!agentId) return;
    setSaving(true);
    try {
      const updated = await api.agents.update(agentId as never, { name, role, personality, system_prompt: systemPrompt });
      setAgent(updated);
      selectAgent(updated);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 size={20} className={styles.spin} />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className={styles.loading}>
        <Text variant="muted">Agent not found</Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          {agent.icon ? (
            <img src={agent.icon} alt="" className={styles.avatarImg} />
          ) : (
            <Bot size={28} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <Text weight="semibold" size="lg">{agent.name}</Text>
          <Text variant="muted" size="sm">{agent.role}</Text>
        </div>
        <Button size="sm" icon={saving ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />} onClick={handleSave} disabled={saving}>
          Save
        </Button>
      </div>

      <div className={styles.form}>
        <label className={styles.field}>
          <Text size="sm" weight="medium">Name</Text>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <Text size="sm" weight="medium">Role</Text>
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className={styles.field}>
          <Text size="sm" weight="medium">Personality</Text>
          <textarea className={styles.textarea} rows={3} value={personality} onChange={(e) => setPersonality(e.target.value)} />
        </label>
        <label className={styles.field}>
          <Text size="sm" weight="medium">System Prompt</Text>
          <textarea className={styles.textarea} rows={8} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        </label>
        {agent.skills.length > 0 && (
          <div className={styles.field}>
            <Text size="sm" weight="medium">Skills</Text>
            <div className={styles.skills}>
              {agent.skills.map((s) => <Badge key={s} variant="pending">{s}</Badge>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
