import { renderHook, act } from "@testing-library/react";
import { useAuraCapabilities, AURA_BREAKPOINTS } from "./use-aura-capabilities";

type MediaQueryHandler = (e: { matches: boolean }) => void;

function createMockMatchMedia() {
  const listeners = new Map<string, Set<MediaQueryHandler>>();

  const matchMedia = vi.fn((query: string) => {
    if (!listeners.has(query)) listeners.set(query, new Set());
    return {
      matches: false,
      media: query,
      addEventListener: (_: string, handler: MediaQueryHandler) => {
        listeners.get(query)!.add(handler);
      },
      removeEventListener: (_: string, handler: MediaQueryHandler) => {
        listeners.get(query)!.delete(handler);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    };
  });

  return { matchMedia, listeners };
}

describe("useAuraCapabilities", () => {
  let origMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    origMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = origMatchMedia;
  });

  it("returns default desktop capabilities", () => {
    const { matchMedia } = createMockMatchMedia();
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useAuraCapabilities());

    expect(result.current.isMobileLayout).toBe(false);
    expect(result.current.isPhoneLayout).toBe(false);
    expect(result.current.isTabletLayout).toBe(false);
    expect(result.current.hasDesktopBridge).toBe(false);
    expect(result.current.features.hostRetargeting).toBe(true);
  });

  it("detects phone layout", () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === `(max-width: ${AURA_BREAKPOINTS.phoneMax}px)` ||
               query === `(max-width: ${AURA_BREAKPOINTS.tabletMax}px)`,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useAuraCapabilities());

    expect(result.current.isPhoneLayout).toBe(true);
    expect(result.current.isTabletLayout).toBe(true);
    expect(result.current.isMobileLayout).toBe(true);
  });

  it("cleans up listeners on unmount", () => {
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn(() => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    const removeWindowListener = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useAuraCapabilities());
    unmount();

    expect(removeEventListener).toHaveBeenCalled();
    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    removeWindowListener.mockRestore();
  });
});
