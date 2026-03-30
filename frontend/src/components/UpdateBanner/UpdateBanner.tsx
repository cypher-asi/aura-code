import { Text } from "@cypher-asi/zui";
import { Download } from "lucide-react";
import { useUpdateBanner } from "./useUpdateBanner";
import styles from "./UpdateBanner.module.css";

export function UpdateBanner() {
  const { data, enabled } = useUpdateBanner();

  if (!enabled || !data) return null;

  const { update } = data;

  if (update.status === "downloading") {
    return (
      <div className={styles.banner} data-variant="info">
        <Download size={14} className={styles.icon} />
        <Text size="sm">Downloading update&hellip;</Text>
      </div>
    );
  }

  if (update.status === "installing") {
    return (
      <div className={styles.banner} data-variant="ready">
        <Download size={14} className={styles.icon} />
        <Text size="sm">
          Installing Aura v{update.version} and restarting&hellip;
        </Text>
      </div>
    );
  }

  return null;
}
