import { Button } from "@cypher-asi/zui";
import { Coins } from "lucide-react";
import styles from "./TaskbarRight.module.css";

// TODO: Replace with real credits data from API/context once billing is implemented
const PLACEHOLDER_CREDITS = 0;

export function TaskbarRight() {
  return (
    <div className={`taskbar-section ${styles.container}`}>
      <div className={styles.credits}>
        <Coins size={13} />
        <span className={styles.creditAmount}>{PLACEHOLDER_CREDITS}</span>
        <span>credits</span>
      </div>
      <Button variant="outline" size="sm" onClick={() => {/* TODO: open billing/purchase flow */}}>
        Buy Credits
      </Button>
    </div>
  );
}
