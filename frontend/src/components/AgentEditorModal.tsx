import { useState, useEffect, useCallback, useRef } from "react";
import { Modal, Input, Textarea, Button, Spinner, Text } from "@cypher-asi/zui";
import { api } from "../api/client";
import type { Agent } from "../types";
import styles from "./AgentEditorModal.module.css";

interface AgentEditorModalProps {
  isOpen: boolean;
  agent?: Agent;
  onClose: () => void;
  onSaved: (agent: Agent) => void;
}

export function AgentEditorModal({ isOpen, agent, onClose, onSaved }: AgentEditorModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const isEditing = !!agent;

  useEffect(() => {
    if (!isOpen) return;
    if (agent) {
      setName(agent.name);
      setRole(agent.role);
      setPersonality(agent.personality);
      setSystemPrompt(agent.system_prompt);
      setIcon(agent.icon ?? "");
    } else {
      setName("");
      setRole("");
      setPersonality("");
      setSystemPrompt("");
      setIcon("");
    }
    setError("");
    setNameError("");
  }, [isOpen, agent]);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => nameRef.current?.focus());
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setError("");
    setNameError("");
    setSaving(false);
    onClose();
  }, [onClose]);

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        role: role.trim(),
        personality: personality.trim(),
        system_prompt: systemPrompt.trim(),
        icon: icon.trim() || undefined,
      };
      const saved = isEditing
        ? await api.agents.update(agent.agent_id, payload)
        : await api.agents.create({ ...payload, icon: payload.icon ?? "" });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Edit Agent" : "Create Agent"}
      size="md"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner size="sm" /> Saving...</> : isEditing ? "Save Changes" : "Create Agent"}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Name *</label>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="e.g. Atlas"
              validationMessage={nameError}
            />
          </div>
          <div className={`${styles.fieldGroup} ${styles.iconField}`}>
            <label className={styles.label}>Icon</label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🤖"
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Role</label>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior Developer"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Personality</label>
          <Textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="e.g. Thorough, opinionated, loves clean code"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>System Prompt</label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Instructions for this agent (agents.md content)..."
            rows={6}
            mono
          />
        </div>

        {error && <Text variant="muted" size="sm" className={styles.error}>{error}</Text>}
      </div>
    </Modal>
  );
}
