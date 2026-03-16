import { useNavigate } from "react-router-dom";
import { Button } from "@cypher-asi/zui";
import { CircleUserRound } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import styles from "./AppNavRail.module.css";

export function AppNavRail() {
  const { apps, activeApp } = useAppContext();
  const navigate = useNavigate();

  return (
    <nav className={styles.rail}>
      <div className={styles.appGroup}>
        {apps
          .filter((app) => app.id !== "profile")
          .map((app) => (
            <Button
              key={app.id}
              variant="ghost"
              size="sm"
              iconOnly
              selected={activeApp.id === app.id}
              icon={<app.icon size={28} />}
              title={app.label}
              aria-label={app.label}
              className={styles.btn}
              onClick={() => navigate(app.basePath)}
            />
          ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        selected={activeApp.id === "profile"}
        icon={<CircleUserRound size={28} />}
        title="Profile"
        aria-label="Profile"
        className={styles.profileBtn}
        onClick={() => navigate("/profile")}
      />
    </nav>
  );
}
