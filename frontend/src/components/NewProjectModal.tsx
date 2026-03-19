import { useState, useCallback, useEffect, useRef } from "react";
import { api, type OrbitRepo } from "../api/client";
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

type OrbitRepoMode = "default" | "custom" | "existing" | "none";

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
  const [orbitRepoMode, setOrbitRepoMode] = useState<OrbitRepoMode>("default");
  const [orbitRepos, setOrbitRepos] = useState<OrbitRepo[]>([]);
  const [orbitReposLoading, setOrbitReposLoading] = useState(false);
  const [selectedOrbitRepo, setSelectedOrbitRepo] = useState<OrbitRepo | null>(null);
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
    setOrbitRepoMode("default");
    setOrbitRepos([]);
    setSelectedOrbitRepo(null);
    setLoading(false);
    setError("");
    setNameError("");
  }, []);

  useEffect(() => {
    if (isOpen && !isAuthenticated) {
      setOrbitRepoMode("none");
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    if (!isOpen || orbitRepoMode !== "existing" || !isAuthenticated) return;
    setOrbitReposLoading(true);
    api
      .listOrbitRepos()
      .then(setOrbitRepos)
      .catch(() => setOrbitRepos([]))
      .finally(() => setOrbitReposLoading(false));
  }, [isOpen, orbitRepoMode, isAuthenticated]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError("Project name is required");
      return;
    }
    if (orbitRepoMode === "existing" && !selectedOrbitRepo) {
      setError("Please select an existing repo");
      return;
    }
    setNameError("");
    setError("");
    setLoading(true);
    try {
      if (!activeOrg) return;
      const repoSlug =
        orbitRepoMode === "custom"
          ? (orbitRepoName.trim() || slugFromName(name) || "my-project")
          : slugFromName(name) || "my-project";
      const payload = {
        org_id: activeOrg.org_id,
        name: name.trim(),
        description: description.trim(),
        linked_folder_path: folderPath.trim(),
        git_branch: "main" as const,
        orbit_owner: undefined as string | undefined,
        orbit_repo: undefined as string | undefined,
        git_repo_url: undefined as string | undefined,
      };
      if (orbitRepoMode === "existing" && selectedOrbitRepo) {
        payload.git_repo_url = selectedOrbitRepo.clone_url ?? `${selectedOrbitRepo.owner}/${selectedOrbitRepo.name}`;
        payload.orbit_owner = selectedOrbitRepo.owner;
        payload.orbit_repo = selectedOrbitRepo.name;
      } else if (orbitRepoMode !== "none") {
        payload.orbit_owner = orbitOwner ?? undefined;
        payload.orbit_repo = repoSlug;
      }
      const project = await api.createProject(payload);
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
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={
              loading ||
              orgLoading ||
              !activeOrg ||
              (orbitRepoMode === "existing" && !selectedOrbitRepo)
            }
          >
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
                  checked={orbitRepoMode === "default"}
                  onChange={() => setOrbitRepoMode("default")}
                />
                <span>Create new repo with default name</span>
              </label>
              {orbitRepoMode === "default" && (
                <div style={{ paddingLeft: "var(--space-6)" }}>
                  <Text variant="muted" size="sm">
                    orbit/{orbitOwner}/{proposedRepoSlug}
                  </Text>
                  <Text variant="muted" size="xs" style={{ opacity: 0.85, marginTop: "var(--space-1)" }}>
                    Format: orbit/UUID/name
                  </Text>
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="radio"
                  checked={orbitRepoMode === "custom"}
                  onChange={() => setOrbitRepoMode("custom")}
                />
                <span>Create new repo with custom name</span>
              </label>
              {orbitRepoMode === "custom" && (
                <div style={{ paddingLeft: "var(--space-6)" }}>
                  <Text variant="muted" size="sm">
                    orbit/{orbitOwner}/{displayRepoName}
                  </Text>
                  <Text variant="muted" size="xs" style={{ opacity: 0.85, marginTop: "var(--space-1)" }}>
                    Format: orbit/UUID/name
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
                  checked={orbitRepoMode === "existing"}
                  onChange={() => setOrbitRepoMode("existing")}
                />
                <span>Use existing repo</span>
              </label>
              {orbitRepoMode === "existing" && (
                <div style={{ paddingLeft: "var(--space-6)" }}>
                  {orbitReposLoading ? (
                    <Spinner size="sm" />
                  ) : orbitRepos.length === 0 ? (
                    <Text variant="muted" size="sm">
                      No repos found. Create a new repo instead or check Orbit configuration.
                    </Text>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <Text variant="muted" size="sm">
                        Select a repo to link:
                      </Text>
                      <select
                        value={selectedOrbitRepo ? `${selectedOrbitRepo.owner}/${selectedOrbitRepo.name}` : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const repo = orbitRepos.find(
                            (r) => `${r.owner}/${r.name}` === val
                          );
                          setSelectedOrbitRepo(repo ?? null);
                        }}
                        style={{
                          padding: "var(--space-2)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <option value="">— Select repo —</option>
                        {orbitRepos.map((r) => (
                          <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                            {r.owner}/{r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input
              type="radio"
              checked={orbitRepoMode === "none"}
              onChange={() => setOrbitRepoMode("none")}
            />
            <span>No Orbit repo</span>
          </label>
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
