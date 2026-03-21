import { renderHook, act } from "@testing-library/react";
import { useAutoScroll } from "./use-auto-scroll";

class MockMutationObserver {
  callback: MutationCallback;
  static instances: MockMutationObserver[] = [];
  constructor(callback: MutationCallback) {
    this.callback = callback;
    MockMutationObserver.instances.push(this);
  }
  observe = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => [] as MutationRecord[]);
  trigger(): void {
    this.callback([], this);
  }
}

class MockResizeObserver {
  callback: ResizeObserverCallback;
  static instances: MockResizeObserver[] = [];
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe("useAutoScroll", () => {
  let origMO: typeof MutationObserver;
  let origRO: typeof ResizeObserver;
  let origRAF: typeof requestAnimationFrame;
  let origCAF: typeof cancelAnimationFrame;

  beforeEach(() => {
    origMO = globalThis.MutationObserver;
    origRO = globalThis.ResizeObserver;
    origRAF = globalThis.requestAnimationFrame;
    origCAF = globalThis.cancelAnimationFrame;
    MockMutationObserver.instances = [];
    MockResizeObserver.instances = [];

    globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    let rafId = 0;
    const pending = new Map<number, FrameRequestCallback>();
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      const id = ++rafId;
      pending.set(id, cb);
      Promise.resolve().then(() => {
        const fn = pending.get(id);
        if (fn) {
          pending.delete(id);
          fn(performance.now());
        }
      });
      return id;
    };
    globalThis.cancelAnimationFrame = (id: number) => {
      pending.delete(id);
    };
  });

  afterEach(() => {
    globalThis.MutationObserver = origMO;
    globalThis.ResizeObserver = origRO;
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
  });

  function makeScrollableEl(): HTMLDivElement {
    const el = document.createElement("div");
    Object.defineProperties(el, {
      scrollHeight: { value: 1000, writable: true, configurable: true },
      scrollTop: { value: 960, writable: true, configurable: true },
      clientHeight: { value: 400, writable: true, configurable: true },
      clientWidth: { value: 300, writable: true, configurable: true },
    });
    return el;
  }

  it("returns handleScroll and scrollToBottom functions", () => {
    const el = makeScrollableEl();
    const ref = { current: el };

    const { result } = renderHook(() => useAutoScroll(ref));

    expect(typeof result.current.handleScroll).toBe("function");
    expect(typeof result.current.scrollToBottom).toBe("function");
  });

  it("sets up MutationObserver and ResizeObserver", () => {
    const el = makeScrollableEl();
    const ref = { current: el };

    renderHook(() => useAutoScroll(ref));

    expect(MockMutationObserver.instances.length).toBeGreaterThan(0);
    expect(MockResizeObserver.instances.length).toBeGreaterThan(0);
  });

  it("disconnects observers on unmount", () => {
    const el = makeScrollableEl();
    const ref = { current: el };

    const { unmount } = renderHook(() => useAutoScroll(ref));
    const mo = MockMutationObserver.instances[0];
    const ro = MockResizeObserver.instances[0];

    unmount();

    expect(mo.disconnect).toHaveBeenCalled();
    expect(ro.disconnect).toHaveBeenCalled();
  });

  it("scrollToBottom sets scrollTop to scrollHeight", () => {
    const el = makeScrollableEl();
    const ref = { current: el };

    const { result } = renderHook(() => useAutoScroll(ref));

    act(() => {
      result.current.scrollToBottom();
    });

    expect(el.scrollTop).toBe(1000);
  });

  it("resets auto-scroll when resetKey changes", () => {
    const el = makeScrollableEl();
    const ref = { current: el };

    const { rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) => useAutoScroll(ref, resetKey),
      { initialProps: { resetKey: "a" } },
    );

    rerender({ resetKey: "b" });
    expect(MockMutationObserver.instances.length).toBeGreaterThan(0);
  });
});
