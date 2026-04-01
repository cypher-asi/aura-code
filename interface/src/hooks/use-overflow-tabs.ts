import { useState, useMemo, useEffect, useLayoutEffect, useCallback, type RefObject } from "react";

interface OverflowResult<T> {
  visibleItems: readonly T[];
  overflowItems: readonly T[];
}

/**
 * Dynamically splits `items` into visible / overflow buckets based on how
 * many icon-only buttons fit inside `containerRef` (the outer flex row that
 * holds both the tab bar and the more-button).
 *
 * `alwaysShowMore` – when true the more-button slot is always reserved
 * (useful when the button has permanent actions like Edit / Delete).
 */
export function useOverflowTabs<T>(
  containerRef: RefObject<HTMLElement | null>,
  items: readonly T[],
  alwaysShowMore = false,
): OverflowResult<T> {
  const [maxVisible, setMaxVisible] = useState(items.length);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    const tabBar = container.firstElementChild as HTMLElement | null;
    if (!tabBar) return;
    const btn = tabBar.querySelector<HTMLElement>(":scope > button");
    if (!btn) return;

    const btnW = btn.offsetWidth;
    if (btnW <= 0) return;

    const tabGap = parseFloat(getComputedStyle(tabBar).gap) || 0;
    const slot = btnW + tabGap;

    const cs = getComputedStyle(container);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const containerGap = parseFloat(cs.gap) || 0;
    const totalAvailable = container.clientWidth - padX;

    const moreSlot = btnW + containerGap;

    if (alwaysShowMore) {
      const forTabs = totalAvailable - moreSlot;
      const n = Math.max(1, Math.floor((forTabs + tabGap) / slot));
      setMaxVisible(Math.min(n, items.length));
      return;
    }

    const allW = items.length * btnW + (items.length - 1) * tabGap;
    if (allW <= totalAvailable) {
      setMaxVisible(items.length);
      return;
    }

    const forTabs = totalAvailable - moreSlot;
    const n = Math.max(1, Math.floor((forTabs + tabGap) / slot));
    setMaxVisible(Math.min(n, items.length));
  }, [containerRef, items.length, alwaysShowMore]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const ro = new ResizeObserver(() => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [containerRef, measure]);

  const n = Math.min(maxVisible, items.length);
  return useMemo(
    () => ({ visibleItems: items.slice(0, n), overflowItems: items.slice(n) }),
    [items, n],
  );
}
