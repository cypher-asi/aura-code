import { useState } from "react";
import { Modal, Input, Button, Text } from "@cypher-asi/zui";
import { cronApi } from "../../../api/cron";
import { useCronStore } from "../stores/cron-store";
import { SchedulePicker } from "./SchedulePicker";
import { TagSelector } from "./TagSelector";
import styles from "./CronJobForm.module.css";

interface Props {
  onClose: () => void;
}

export function CronJobForm({ onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("0 9 * * *");
  const [tag, setTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addJob = useCronStore((s) => s.addJob);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await cronApi.createJob({
        name,
        description,
        schedule,
        tag: tag.trim() || undefined,
      });
      addJob(job);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create cron job";
      setError(msg);
      console.error("Failed to create cron job:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Create Cron Job"
      size="md"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
          >
            {submitting ? "Creating..." : "Create Job"}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Email Digest"
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Tag</label>
          <TagSelector value={tag} onChange={setTag} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Schedule</label>
          <SchedulePicker value={schedule} onChange={setSchedule} />
        </div>
        {error && <Text variant="muted" size="sm" className={styles.error}>{error}</Text>}
      </div>
    </Modal>
  );
}
