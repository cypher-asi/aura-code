import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "../api/client";
import { useOrg } from "../context/OrgContext";
import { useAuth } from "../context/AuthContext";
import { Modal, Input, Button, Spinner, Text } from "@cypher-asi/zui";
import { PathInput } from "./PathInput";

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: import("../types").Project) => void;
}

export function NewProjectModal({ isOpen, onClose, onCreated }: NewProjectModalProps) {
  const { activeOrg, isLoading: orgLoading } = useOrg();
  const { user, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [orbitRepoName, setOrbitRepoName] = useState("");
  const [useExistingRepo, setUseExistingRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const orbitOwner = activeOrg?.org_id ?? user?.user_id ?? null;
  const proposedRepoSlug = slugFromName(name) || "my-project";
  const displayRepoName = orbitRepoName.trim() || proposedRepoSlug;

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [isOpen]);

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setFolderPath("");
    setOrbitRepoName("");
    setUseExistingRepo(false);
    setLoading(false);
    setError("");
    setNameError("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError("Project name is required");
      return;
    }
    setNameError("");
    setLoading(true);
    setError("");
    try {
      if (!activeOrg) return;
      const repoSlug = orbitRepoName.trim() || slugFromName(name) || "my-project";
      const project = await api.createProject({
        org_id: activeOrg.org_id,
        name: name.trim(),
        description: description.trim(),
        linked_folder_path: folderPath.trim(),
        git_branch: "main",
        orbit_owner: orbitOwner ?? undefined,
        orbit_repo: !useExistingRepo ? repoSlug : undefined,
      });
      reset();
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Project"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading || orgLoading || !activeOrg}>
            {loading ? <><Spinner size="sm" /> Creating...</> : "Create Project"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          placeholder="Project name"
          validationMessage={nameError}
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <PathInput
          value={folderPath}
          onChange={setFolderPath}
          placeholder="Linked folder path"
          mode="folder"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Text variant="muted" size="sm" style={{ marginTop: "var(--space-2)" }}>
            Orbit repo (optional)
          </Text>
          {!isAuthenticated && (
            <Text variant="muted" size="sm" style={{ color: "var(--color-warning)" }}>
              Sign in to create a new repo or choose an existing one.
            </Text>
          )}
          {isAuthenticated && orbitOwner && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="radio"
                  checked={!useExistingRepo}
                  onChange={() => setUseExistingRepo(false)}
                />
                <span>Create new repo</span>
              </label>
              {!useExistingRepo && (
                <div style={{ paddingLeft: "var(--space-6)" }}>
                  <Text variant="muted" size="sm">
                    {orbitOwner}/{displayRepoName}
                  </Text>
                  <Input
                    value={orbitRepoName}
                    onChange={(e) => setOrbitRepoName(e.target.value)}
                    placeholder={`Repo name (default: ${proposedRepoSlug})`}
                    style={{ marginTop: "var(--space-1)" }}
                  />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="radio"
                  checked={useExistingRepo}
                  onChange={() => setUseExistingRepo(true)}
                />
                <span>Use existing repo</span>
              </label>
              {useExistingRepo && (
                <Text variant="muted" size="sm" style={{ paddingLeft: "var(--space-6)" }}>
                  Search existing repos will be available in a future update.
                </Text>
              )}
            </>
          )}
        </div>
        {!orgLoading && !activeOrg && (
          <Text variant="muted" size="sm" style={{ color: "var(--color-danger)" }}>
            No team found. Log out and back in to create a default team.
          </Text>
        )}
        {error && (
          <Text variant="muted" size="sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </Text>
        )}
      </div>
    </Modal>
  );
}
