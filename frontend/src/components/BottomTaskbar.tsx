import { Button } from "@cypher-asi/zui";
import { Settings } from "lucide-react";
import { OrgSelector } from "./OrgSelector";
import { CreditsBadge } from "./CreditsBadge";
import styles from "./BottomTaskbar.module.css";

interface Props {
  onOpenSettings: () => void;
  onOpenOrgSettings: () => void;
  onBuyCredits?: () => void;
}

export function BottomTaskbar({ onOpenSettings, onOpenOrgSettings, onBuyCredits }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.settingsWrap}>
        <Button
          variant="ghost"
          size="sm"
          className={styles.settingsButton}
          icon={<Settings size={14} />}
          onClick={onOpenSettings}
        >
          Settings
        </Button>
      </div>
      <div className={styles.divider} />
      <div className={styles.orgWrap}>
        <OrgSelector onOpenSettings={onOpenOrgSettings} />
      </div>
      <div className={styles.divider} />
      <div className={styles.creditsWrap}>
        <CreditsBadge onClick={onBuyCredits} />
      </div>
    </div>
  );
}
