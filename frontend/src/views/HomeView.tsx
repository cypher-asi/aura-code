import styles from "./views.module.css";

export function HomeView() {
  return (
    <div className={styles.emptyState}>
      <h3>Welcome to Aura</h3>
      <p>Select a project from the sidebar or create a new one to get started.</p>
    </div>
  );
}
