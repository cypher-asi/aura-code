import { Link } from "react-router-dom";
import { Button } from "@cypher-asi/zui";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import styles from "./UserProfile.module.css";

export function UserProfile() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className={styles.container}>
      <div className={styles.info}>
        <span className={styles.name}>{user.display_name || "User"}</span>
        {user.primary_zid && (
          <span className={styles.zid}>{user.primary_zid}</span>
        )}
      </div>
      <Link to="/settings">
        <Button
          variant="ghost"
          size="sm"
          icon={<Settings size={14} />}
          iconOnly
          aria-label="Settings"
        />
      </Link>
      <Button
        variant="ghost"
        size="sm"
        icon={<LogOut size={14} />}
        iconOnly
        aria-label="Logout"
        onClick={logout}
      />
    </div>
  );
}
