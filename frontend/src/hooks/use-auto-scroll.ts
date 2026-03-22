import { useEffect, useRef, useCallback } from "react";

/**
 * Sets `el.scrollTop` to `target` and guards the resulting scroll event so
 * it isn't misread as a user-initiated scroll (which would disable
 * auto-scroll when new content increases scrollHeight between the
 * assignment and the event).
 */
function guardedScroll(
  el: HTMLElement,
  target: number,
  guardRef: React.MutableRefObject<boolean>,
) {
  guardRef.current = true;
  el.scrollTop = target;
  requestAnimationFrame(() => {
    guardRef.current = false;
  });
}

/**
 * Auto-scrolls a container to the bottom whenever its content changes,
 * but only if the user is already near the bottom. Uses MutationObserver
 * to detect DOM changes and ResizeObserver to compensate for content
 * reflow when the container width changes (e.g. lane resize).
 */
export function useAutoScroll(
  ref: React.RefObject<HTMLElement | null>,
  resetKey?: unknown,
): { handleScroll: () => void; scrollToBottom: () => void } {
  const autoScrollRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const programmaticScrollRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    autoScrollRef.current = true;

    const syncHeight = () => {
      prevScrollHeightRef.current = el.scrollHeight;
    };

    const scrollIfNeeded = () => {
      if (autoScrollRef.current) {
        guardedScroll(el, el.scrollHeight, programmaticScrollRef);
      }
    };

    const mutationObs = new MutationObserver(() => {
      scrollIfNeeded();
      syncHeight();
    });
    mutationObs.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    let lastWidth = el.clientWidth;
    const resizeObs = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w === lastWidth) return;
      lastWidth = w;

      const oldSH = prevScrollHeightRef.current;
      const newSH = el.scrollHeight;

      if (autoScrollRef.current) {
        guardedScroll(el, newSH, programmaticScrollRef);
      } else if (oldSH > 0 && newSH !== oldSH) {
        guardedScroll(
          el,
          Math.round(el.scrollTop * (newSH / oldSH)),
          programmaticScrollRef,
        );
      }

      syncHeight();
    });
    resizeObs.observe(el);

    scrollIfNeeded();
    syncHeight();

    return () => {
      mutationObs.disconnect();
      resizeObs.disconnect();
    };
  }, [ref, resetKey]);

  const handleScroll = useCallback(() => {
    if (programmaticScrollRef.current) return;
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  }, [ref]);

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true;
    const el = ref.current;
    if (el) {
      guardedScroll(el, el.scrollHeight, programmaticScrollRef);
    }
  }, [ref]);

  return { handleScroll, scrollToBottom };
}
