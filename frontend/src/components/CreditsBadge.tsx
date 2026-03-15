import { useEffect, useState, useCallback } from "react";
import { Coins } from "lucide-react";
import { useOrg } from "../context/OrgContext";
import { api } from "../api/client";
import styles from "./CreditsBadge.module.css";

export const CREDITS_UPDATED_EVENT = "credits-updated";

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

interface Props {
  onClick?: () => void;
}

export function CreditsBadge({ onClick }: Props) {
  const { activeOrg } = useOrg();
  const [credits, setCredits] = useState<number | null>(null);

  const fetchBalance = useCallback(() => {
    if (!activeOrg) {
      setCredits(null);
      return;
    }
    api.orgs
      .getCreditBalance(activeOrg.org_id)
      .then((b) => setCredits(b.total_credits))
      .catch(() => {});
  }, [activeOrg?.org_id]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    const handler = () => fetchBalance();
    window.addEventListener(CREDITS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, handler);
  }, [fetchBalance]);

  const displayCredits = credits !== null ? formatCredits(credits) : "---";
  return (
    <div className={styles.creditsBadge} onClick={onClick} role="button" tabIndex={0}>
      <span className={credits === null || credits === 0 ? `${styles.label} ${styles.labelSecondary}` : styles.label}>{displayCredits}</span>
      <Coins size={14} className={styles.icon} />
    </div>
  );
}
