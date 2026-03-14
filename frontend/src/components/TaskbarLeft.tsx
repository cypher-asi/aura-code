import { Button } from "@cypher-asi/zui";
import { Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { OrgSelector } from "./OrgSelector";
import styles from "./TaskbarLeft.module.css";

interface Props {
  onOpenSettings: () => void;
  onOpenOrgSettings: () => void;
}

export function TaskbarLeft({ onOpenSettings, onOpenOrgSettings }: Props) {
  const { user } = useAuth();

  return (
    <div className={`taskbar-section ${styles.container}`}>
      <span className={styles.name}>{user?.display_name || "User"}</span>
      <span className={styles.separator}>/</span>
      <div className={styles.orgWrap}>
        <OrgSelector onOpenSettings={onOpenOrgSettings} />
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={<Settings size={14} />}
        iconOnly
        aria-label="Settings"
        onClick={onOpenSettings}
      />
    </div>
  );
}
