import { Modal, Input, Button } from "@cypher-asi/zui";
import type { Project, ChatSession } from "../types";
import styles from "./ProjectList.module.css";

interface RenameModalProps {
  target: Project | null;
  name: string;
  onNameChange: (name: string) => void;
  loading: boolean;
  onClose: () => void;
  onRename: () => void;
}

export function RenameProjectModal({ target, name, onNameChange, loading, onClose, onRename }: RenameModalProps) {
  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="Rename Project"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onRename} disabled={loading || !name.trim()}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onRename(); }}
        placeholder="Project name"
        autoFocus
      />
    </Modal>
  );
}

interface DeleteProjectModalProps {
  target: Project | null;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteProjectModal({ target, loading, onClose, onDelete }: DeleteProjectModalProps) {
  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="Delete Project"
      size="sm"
      footer={
        <div className={styles.confirmFooter}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onDelete} disabled={loading} className={styles.dangerButton}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      }
    >
      <div className={styles.confirmMessage}>
        Are you sure you want to delete &ldquo;{target?.name}&rdquo;? This action cannot be undone.
      </div>
    </Modal>
  );
}

interface DeleteSessionModalProps {
  target: ChatSession | null;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteSessionModal({ target, loading, onClose, onDelete }: DeleteSessionModalProps) {
  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="Delete Chat"
      size="sm"
      footer={
        <div className={styles.confirmFooter}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onDelete} disabled={loading} className={styles.dangerButton}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      }
    >
      <div className={styles.confirmMessage}>
        Are you sure you want to delete this chat session? This action cannot be undone.
      </div>
    </Modal>
  );
}
