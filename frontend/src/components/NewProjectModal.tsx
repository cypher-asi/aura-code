import { useState } from "react";
import { api } from "../api/client";
import { Modal, Input, Textarea, Label, Button, Spinner, Text } from "@cypher-asi/zui";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export function NewProjectModal({ isOpen, onClose, onCreated }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [reqPath, setReqPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");

  const reset = () => {
    setName("");
    setDescription("");
    setFolderPath("");
    setReqPath("");
    setLoading(false);
    setError("");
    setNameError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError("Project name is required");
      return;
    }
    setNameError("");
    setLoading(true);
    setError("");
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        linked_folder_path: folderPath.trim(),
        requirements_doc_path: reqPath.trim(),
      });
      reset();
      onCreated(project.project_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { display: "block" as const, marginBottom: "var(--space-1)" };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Project"
      subtitle="Create a new project to start building"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><Spinner size="sm" /> Creating...</> : "Create Project"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div>
          <Label size="sm" uppercase={false} style={labelStyle}>Project Name *</Label>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(""); }}
            placeholder="My Awesome App"
            validationMessage={nameError}
            autoFocus
          />
        </div>
        <div>
          <Label size="sm" uppercase={false} style={labelStyle}>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the project..."
          />
        </div>
        <div>
          <Label size="sm" uppercase={false} style={labelStyle}>Linked Folder Path</Label>
          <Input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/path/to/your/codebase"
            mono
          />
        </div>
        <div>
          <Label size="sm" uppercase={false} style={labelStyle}>Requirements Doc Path</Label>
          <Input
            value={reqPath}
            onChange={(e) => setReqPath(e.target.value)}
            placeholder="/path/to/requirements.md"
            mono
          />
        </div>
        {error && (
          <Text variant="muted" size="sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </Text>
        )}
      </div>
    </Modal>
  );
}
