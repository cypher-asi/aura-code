import { OrgSelector } from "./OrgSelector";
import { CreditsBadge } from "./CreditsBadge";
import { useUIModalStore } from "../stores/ui-modal-store";
import styles from "./BottomTaskbar.module.css";

export function BottomTaskbar() {
  const openOrgBilling = useUIModalStore((s) => s.openOrgBilling);

  return (
    <div className={styles.bar}>
      <div className={styles.orgWrap}>
        <OrgSelector />
      </div>
      <div className={styles.divider} />
      <div className={styles.creditsWrap}>
        <CreditsBadge onClick={openOrgBilling} />
      </div>
    </div>
  );
}
