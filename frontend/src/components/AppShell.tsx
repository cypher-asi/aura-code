import { Link, Outlet, useParams } from "react-router-dom";
import { ProjectList } from "./ProjectList";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { projectId } = useParams();

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <Link to="/" className={styles.logo}>Aura</Link>
        <div className={styles.breadcrumb}>
          {projectId && <span>Project loaded</span>}
        </div>
        <Link to="/settings" className={styles.settingsLink}>Settings</Link>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <ProjectList />
        </aside>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
