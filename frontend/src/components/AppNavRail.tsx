import { useNavigate } from "react-router-dom";
import { Button } from "@cypher-asi/zui";
import { useAppContext } from "../context/AppContext";
import styles from "./AppNavRail.module.css";

export function AppNavRail() {
  const { apps, activeApp } = useAppContext();
  const navigate = useNavigate();

  return (
    <nav className={styles.rail}>
      {apps.map((app) => (
        <Button
          key={app.id}
          variant="ghost"
          size="sm"
          iconOnly
          icon={<app.icon size={20} />}
          title={app.label}
          aria-label={app.label}
          className={activeApp.id === app.id ? styles.active : styles.btn}
          onClick={() => navigate(app.basePath)}
        />
      ))}
    </nav>
  );
}
