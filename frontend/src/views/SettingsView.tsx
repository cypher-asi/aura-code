import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApiKeyInfo } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { Spinner } from "../components/Spinner";
import styles from "./views.module.css";

export function SettingsView() {
  const [info, setInfo] = useState<ApiKeyInfo | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .getApiKeyInfo()
      .then(setInfo)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!keyInput.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await api.setApiKey(keyInput.trim());
      setInfo(updated);
      setKeyInput("");
      setMessage("API key saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteApiKey();
      setInfo({ status: "not_set", masked_key: null, last_validated_at: null, updated_at: null });
      setMessage("API key deleted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) return <Spinner size={28} />;

  return (
    <div>
      <div className={styles.viewHeader}>
        <h1 className={styles.viewTitle}>Settings</h1>
        <p className={styles.viewSubtitle}>Manage your Claude API key</p>
      </div>

      <div className={styles.card} style={{ maxWidth: 560 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Claude API Key</h3>

        {info && info.status !== "not_set" && (
          <div className={styles.infoGrid} style={{ marginBottom: 16 }}>
            <span className={styles.infoLabel}>Status</span>
            <span><StatusBadge status={info.status} /></span>
            <span className={styles.infoLabel}>Masked Key</span>
            <span className={styles.infoValue} style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
              {info.masked_key || "—"}
            </span>
            {info.updated_at && (
              <>
                <span className={styles.infoLabel}>Updated</span>
                <span className={styles.infoValue}>{new Date(info.updated_at).toLocaleString()}</span>
              </>
            )}
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            {info?.status === "not_set" ? "Enter API Key" : "Update API Key"}
          </label>
          <input
            className={styles.formInput}
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-..."
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !keyInput.trim()}>
            {saving ? <><Spinner size={14} /> Saving...</> : "Save"}
          </button>
          {info && info.status !== "not_set" && (
            <button className={styles.btnDanger} onClick={handleDelete}>
              Delete Key
            </button>
          )}
        </div>

        {message && <p className={styles.successText}>{message}</p>}
      </div>
    </div>
  );
}
