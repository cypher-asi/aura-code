import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../api/client";
import type { Agent } from "../../types";
import { useModalInitialFocus } from "../../hooks/use-modal-initial-focus";
import { useAuraCapabilities } from "../../hooks/use-aura-capabilities";

interface AgentEditorFormResult {
  name: string;
  setName: (v: string) => void;
  role: string;
  setRole: (v: string) => void;
  isSuperAgent: boolean;
  personality: string;
  setPersonality: (v: string) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  icon: string;
  setIcon: (v: string) => void;
  machineType: string;
  setMachineType: (v: string) => void;
  saving: boolean;
  error: string;
  nameError: string;
  setNameError: (v: string) => void;
  nameRef: React.RefObject<HTMLInputElement | null>;
  initialFocusRef: React.RefObject<HTMLElement> | undefined;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cropOpen: boolean;
  rawImageSrc: string;
  handleSave: () => Promise<void>;
  handleClose: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCropConfirm: (dataUrl: string) => void;
  handleCropClose: () => void;
}

export function useAgentEditorForm(
  isOpen: boolean,
  agent: Agent | undefined,
  onClose: () => void,
  onSaved: (agent: Agent) => void,
): AgentEditorFormResult {
  const { isMobileLayout } = useAuraCapabilities();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [icon, setIcon] = useState("");
  const [machineType, setMachineType] = useState("remote");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState("");
  const { inputRef: nameRef, initialFocusRef } = useModalInitialFocus<HTMLInputElement>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (agent) {
      const isSuperRole = agent.role === "super_agent" || agent.tags?.includes("super_agent");
      setName(agent.name); setRole(isSuperRole ? "" : agent.role);
      setPersonality(agent.personality); setSystemPrompt(agent.system_prompt);
      setIcon(agent.icon ?? "");
      setMachineType(agent.machine_type ?? "local");
    } else {
      setName(""); setRole(""); setPersonality(""); setSystemPrompt(""); setIcon("");
      setMachineType("remote");
    }
    setError(""); setNameError("");
  }, [isOpen, agent]);

  const handleClose = useCallback(() => {
    setError(""); setNameError(""); setSaving(false); onClose();
  }, [onClose]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setRawImageSrc(objectUrl);
    setCropOpen(true);
    e.target.value = "";
  }, []);

  const handleCropConfirm = useCallback((dataUrl: string) => {
    setIcon(dataUrl);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc("");
    setCropOpen(false);
  }, [rawImageSrc]);

  const handleCropClose = useCallback(() => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc("");
  }, [rawImageSrc]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { setNameError("Name is required"); return; }
    setNameError(""); setSaving(true); setError("");
    try {
      const isSuperAgent = agent?.role === "super_agent" || agent?.tags?.includes("super_agent");
      const payload = {
        name: name.trim(), role: isSuperAgent ? "super_agent" : role.trim(),
        personality: personality.trim(), system_prompt: systemPrompt.trim(),
        icon: icon || (agent?.icon ? null : undefined),
        machine_type: !agent && isMobileLayout ? "remote" : machineType,
      };
      const saved = agent
        ? await api.agents.update(agent.agent_id, payload)
        : await api.agents.create({ ...payload, icon: payload.icon ?? "" });
      onSaved(saved); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally { setSaving(false); }
  }, [name, role, personality, systemPrompt, icon, machineType, agent, isMobileLayout, onSaved, onClose]);

  const isSuperAgent = agent?.role === "super_agent" || agent?.tags?.includes("super_agent") || false;

  return {
    name, setName, role, setRole, isSuperAgent, personality, setPersonality,
    systemPrompt, setSystemPrompt, icon, setIcon, machineType, setMachineType,
    saving, error, nameError, setNameError,
    nameRef, initialFocusRef, fileInputRef,
    cropOpen, rawImageSrc,
    handleSave, handleClose, handleFileSelect, handleCropConfirm, handleCropClose,
  };
}
