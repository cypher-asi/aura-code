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
      <button className={styles.nameBtn} onClick={onOpenSettings}>
        {user?.display_name || "User"}
      </button>
      <div className={styles.divider} />
      <div className={styles.orgWrap}>
        <OrgSelector onOpenSettings={onOpenOrgSettings} />
      </div>
    </div>
  );
}
