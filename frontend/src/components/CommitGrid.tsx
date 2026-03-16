import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import styles from "./CommitGrid.module.css";

const CELL_SIZE = 7;
const GAP = 3;
const MONTH_GAP = 10;
const DAYS_PER_WEEK = 7;
const MONTH_BLOCK_WIDTH = DAYS_PER_WEEK * CELL_SIZE + (DAYS_PER_WEEK - 1) * GAP;
const DEFAULT_LEVELS = [1, 4, 8, 12];

interface DaySlot {
  date: string;
  count: number;
}

interface MonthBlock {
  key: string;
  weeks: (DaySlot | null)[][];
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLevel(count: number, thresholds: number[]): number {
  if (count <= 0) return 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (count >= thresholds[i]) return i + 1;
  }
  return 1;
}

function buildMonthBlocks(
  start: Date,
  end: Date,
  data: Record<string, number>,
): MonthBlock[] {
  const blocks: MonthBlock[] = [];
  let year = start.getFullYear();
  let month = start.getMonth();

  while (new Date(year, month, 1) <= end) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;

    const weeks: (DaySlot | null)[][] = [];
    let week: (DaySlot | null)[] = [];

    for (let i = 0; i < mondayOffset; i++) week.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const iso = toISODate(d);
      const inRange = d >= start && d <= end;

      week.push(inRange ? { date: iso, count: data[iso] ?? 0 } : null);

      if (week.length === DAYS_PER_WEEK) {
        weeks.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < DAYS_PER_WEEK) week.push(null);
      weeks.push(week);
    }

    blocks.push({ key: `${year}-${month}`, weeks });

    month++;
    if (month > 11) { month = 0; year++; }
  }

  return blocks;
}

function formatTooltip(date: string, count: number): string {
  const d = new Date(date + "T00:00:00");
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (count === 0) return `No commits on ${label}`;
  return `${count} commit${count === 1 ? "" : "s"} on ${label}`;
}

interface CommitGridProps {
  data: Record<string, number>;
  startDate?: Date;
  endDate?: Date;
  levels?: number[];
  className?: string;
}

export function CommitGrid({
  data,
  startDate,
  endDate,
  levels = DEFAULT_LEVELS,
  className,
}: CommitGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxMonths, setMaxMonths] = useState<number | null>(null);

  const measure = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      setMaxMonths(Math.floor((width + MONTH_GAP) / (MONTH_BLOCK_WIDTH + MONTH_GAP)));
    }
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const end = useMemo(() => endDate ?? new Date(), [endDate]);
  const start = useMemo(() => {
    if (startDate) return startDate;
    const months = maxMonths ?? 12;
    const d = new Date(end);
    d.setMonth(d.getMonth() - months + 1);
    d.setDate(1);
    return d;
  }, [startDate, end, maxMonths]);

  const blocks = useMemo(
    () => buildMonthBlocks(start, end, data),
    [start, end, data],
  );

  return (
    <div ref={containerRef} className={`${styles.root}${className ? ` ${className}` : ""}`}>
      {maxMonths !== null && (
        <div className={styles.grid}>
          {blocks.map((block) => (
            <div key={block.key} className={styles.monthBlock}>
              {block.weeks.map((week, wi) => (
                <div key={wi} className={styles.weekRow}>
                  {week.map((slot, di) =>
                    slot ? (
                      <div
                        key={slot.date}
                        className={styles.cell}
                        data-level={getLevel(slot.count, levels)}
                        title={formatTooltip(slot.date, slot.count)}
                      />
                    ) : (
                      <div key={`e-${wi}-${di}`} className={styles.placeholder} />
                    ),
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
