import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Plus } from "lucide-react";
import { useCreditBalance } from "../CreditsBadge/useCreditBalance";
import { formatCredits } from "../../utils/format";
import { useUIModalStore } from "../../stores/ui-modal-store";
import { ConnectionDot } from "../ConnectionDot/ConnectionDot";
import styles from "./BottomTaskbar.module.css";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function BottomTaskbar() {
  const openBuyCredits = useUIModalStore((s) => s.openBuyCredits);
  const { credits } = useCreditBalance();
  const time = useClock();
  const display = credits !== null ? formatCredits(credits) : "---";
  const navigate = useNavigate();

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.desktopButton}
        onClick={() => navigate("/desktop")}
        title="Desktop"
        aria-label="Desktop"
      >
        <Plus size={14} />
      </button>
      <div className={styles.spacer} />
      <div className={styles.right}>
        <button
          type="button"
          className={styles.creditsButton}
          onClick={openBuyCredits}
        >
          <span className={styles.creditsLabel}>{display}</span>
          <CreditCard size={14} />
        </button>
        <span className={styles.wifiIcon}><ConnectionDot /></span>
        <span className={styles.clock}>{time}</span>
      </div>
    </div>
  );
}
