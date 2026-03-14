import { Button } from "@cypher-asi/zui";
import { CreditsBadge } from "./CreditsBadge";
import styles from "./TaskbarRight.module.css";

export function TaskbarRight() {
  return (
    <div className={`taskbar-section ${styles.container}`}>
      <CreditsBadge />
      <Button variant="secondary" size="sm" onClick={() => {/* TODO: open billing/purchase flow */}}>
        Buy Credits
      </Button>
    </div>
  );
}
