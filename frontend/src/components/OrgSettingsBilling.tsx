import { Input, Button } from "@cypher-asi/zui";
import type { OrgBilling } from "../types";
import styles from "./OrgSettingsPanel.module.css";

interface Props {
  billing: OrgBilling | null;
  billingEmail: string;
  onBillingEmailChange: (email: string) => void;
  isAdminOrOwner: boolean;
  saving: boolean;
  onSave: () => void;
}

export function OrgSettingsBilling({
  billing,
  billingEmail,
  onBillingEmailChange,
  isAdminOrOwner,
  saving,
  onSave,
}: Props) {
  return (
    <>
      <h2 className={styles.sectionTitle}>Billing</h2>

      <div className={styles.settingsGroupLabel}>Plan</div>
      <div className={styles.settingsGroup}>
        <div className={styles.settingsRow}>
          <div className={styles.rowInfo}>
            <span className={styles.rowLabel}>Current Plan</span>
            <span className={styles.rowDescription}>
              Your team's active subscription
            </span>
          </div>
          <div className={styles.rowControl}>
            <span className={styles.roleBadge}>{billing?.plan ?? "free"}</span>
          </div>
        </div>
        {isAdminOrOwner && (
          <div className={styles.settingsRow}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>Billing Email</span>
              <span className={styles.rowDescription}>
                Invoices and receipts will be sent here
              </span>
            </div>
            <div className={styles.rowControl}>
              <Input
                size="sm"
                value={billingEmail}
                onChange={(e) => onBillingEmailChange(e.target.value)}
                placeholder="billing@example.com"
                style={{ width: 200 }}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
