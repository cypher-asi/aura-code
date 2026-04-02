import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Search } from "lucide-react";
import { SkillStoreCategories } from "./SkillStoreCategories";
import { SkillStoreGrid } from "./SkillStoreGrid";
import { SkillStoreDetail } from "./SkillStoreDetail";
import { api } from "../../api/client";
import catalogData from "../../data/skill-store-catalog.json";
import type { SkillCategory, SkillStoreCatalogEntry } from "../../types";
import styles from "./SkillStoreModal.module.css";

const catalog = catalogData as SkillStoreCatalogEntry[];

interface SkillStoreModalProps {
  isOpen: boolean;
  agentId?: string;
  initialInstalledNames?: Set<string>;
  onClose: () => void;
  onInstalled?: () => void;
}

export function SkillStoreModal({ isOpen, agentId, initialInstalledNames, onClose, onInstalled }: SkillStoreModalProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SkillCategory | "all">("all");
  const [selected, setSelected] = useState<SkillStoreCatalogEntry | null>(null);
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  useEffect(() => {
    if (isOpen && initialInstalledNames) {
      setInstalledNames((prev) => {
        const merged = new Set(prev);
        for (const n of initialInstalledNames) merged.add(n);
        return merged;
      });
    }
  }, [isOpen, initialInstalledNames]);

  const filtered = useMemo(() => {
    let result = catalog;
    if (category !== "all") {
      result = result.filter((e) => e.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.tags.some((t) => t.includes(q)),
      );
    }
    return result;
  }, [category, search]);

  const handleInstall = useCallback(async (entry: SkillStoreCatalogEntry) => {
    setInstalling(true);
    try {
      await api.harnessSkills.installFromStore(entry.name, entry.source_url);
      if (agentId) {
        await api.harnessSkills.installAgentSkill(agentId, entry.name, entry.source_url).catch(() => {});
      }
      setInstalledNames((prev) => new Set(prev).add(entry.name));
      onInstalled?.();
    } catch { /* best-effort */ }
    setInstalling(false);
  }, [agentId, onInstalled]);

  const handleUninstall = useCallback(async (entry: SkillStoreCatalogEntry) => {
    if (!agentId) return;
    setUninstalling(true);
    try {
      await api.harnessSkills.uninstallAgentSkill(agentId, entry.name);
      setInstalledNames((prev) => {
        const next = new Set(prev);
        next.delete(entry.name);
        return next;
      });
      onInstalled?.();
    } catch { /* best-effort */ }
    setUninstalling(false);
  }, [agentId, onInstalled]);

  const handleClose = useCallback(() => {
    setSelected(null);
    setSearch("");
    setCategory("all");
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBar}>
          <span className={styles.title}>Skill Store</span>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.sidebar}>
            <SkillStoreCategories
              catalog={catalog}
              selected={category}
              onSelect={(c) => { setCategory(c); setSelected(null); }}
            />
          </div>

          <div className={styles.content}>
            {selected ? (
              <SkillStoreDetail
                entry={selected}
                installed={installedNames.has(selected.name)}
                installing={installing}
                uninstalling={uninstalling}
                onBack={() => setSelected(null)}
                onInstall={() => handleInstall(selected)}
                onUninstall={() => handleUninstall(selected)}
              />
            ) : (
              <SkillStoreGrid
                entries={filtered}
                installedNames={installedNames}
                onSelect={setSelected}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
