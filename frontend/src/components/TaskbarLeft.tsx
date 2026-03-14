import { Button } from "@cypher-asi/zui";
import { Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import styles from "./TaskbarLeft.module.css";

export function TaskbarLeft({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useAuth();
  const { activeOrg } = useOrg();

  return (
    <div className={`taskbar-section ${styles.container}`}>
      <div className={styles.userOrg}>
        <span className={styles.name}>{user?.display_name || "User"}</span>
        <span className={styles.separator}>/</span>
        <span className={styles.org}>{activeOrg?.name ?? "My Team"}</span>
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
