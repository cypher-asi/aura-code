import { renderHook, act } from "@testing-library/react";
import { useStreamCore } from "./use-stream-core";
import { useStreamStore, streamMetaMap, ensureEntry } from "./stream/store";
import type { DisplayMessage } from "../types/stream";

describe("useStreamCore", () => {
  beforeEach(() => {
    streamMetaMap.clear();
    useStreamStore.setState({ entries: {} });
  });

  it("returns key, refs, setters, and utility functions", () => {
    const { result } = renderHook(() => useStreamCore(["project-1", "agent-1"]));

    expect(result.current.key).toBe("project-1:agent-1");
    expect(result.current.refs).toBeDefined();
    expect(result.current.setters).toBeDefined();
    expect(typeof result.current.resetMessages).toBe("function");
    expect(typeof result.current.baseStopStreaming).toBe("function");
    expect(typeof result.current.setMessages).toBe("function");
    expect(typeof result.current.setIsStreaming).toBe("function");
    expect(typeof result.current.setProgressText).toBe("function");
  });

  it("creates a store entry for the key", () => {
    renderHook(() => useStreamCore(["k1"]));

    const entry = useStreamStore.getState().entries["k1"];
    expect(entry).toBeDefined();
    expect(entry.isStreaming).toBe(false);
    expect(entry.messages).toEqual([]);
  });

  it("filters falsy values from key", () => {
    const { result } = renderHook(() => useStreamCore([undefined, "project-1", null, "agent-1"]));

    expect(result.current.key).toBe("project-1:agent-1");
  });

  it("setMessages updates store", () => {
    const { result } = renderHook(() => useStreamCore(["test"]));

    const msg: DisplayMessage = {
      id: "m1",
      role: "user",
      content: "hello",
    };

    act(() => {
      result.current.setMessages([msg]);
    });

    const entry = useStreamStore.getState().entries["test"];
    expect(entry.messages).toHaveLength(1);
    expect(entry.messages[0].content).toBe("hello");
  });

  it("resetMessages updates store when not streaming", () => {
    const { result } = renderHook(() => useStreamCore(["test"]));

    act(() => {
      result.current.setMessages([
        { id: "m1", role: "user", content: "hello" },
      ]);
    });

    act(() => {
      result.current.resetMessages([]);
    });

    const entry = useStreamStore.getState().entries["test"];
    expect(entry.messages).toEqual([]);
  });

  it("resetMessages does not update when streaming", () => {
    const { result } = renderHook(() => useStreamCore(["test"]));

    act(() => {
      result.current.setIsStreaming(true);
      result.current.setMessages([
        { id: "m1", role: "user", content: "hello" },
      ]);
    });

    act(() => {
      result.current.resetMessages([]);
    });

    const entry = useStreamStore.getState().entries["test"];
    expect(entry.messages).toHaveLength(1);
  });

  it("resetMessages with allowWhileStreaming bypasses guard", () => {
    const { result } = renderHook(() => useStreamCore(["test"]));

    act(() => {
      result.current.setIsStreaming(true);
      result.current.setMessages([
        { id: "m1", role: "user", content: "hello" },
      ]);
    });

    act(() => {
      result.current.resetMessages([], { allowWhileStreaming: true });
    });

    const entry = useStreamStore.getState().entries["test"];
    expect(entry.messages).toEqual([]);
  });

  it("baseStopStreaming aborts and resets stream buffers", () => {
    const { result } = renderHook(() => useStreamCore(["test"]));
    const abortSpy = vi.fn();

    act(() => {
      result.current.setIsStreaming(true);
      const controller = new AbortController();
      controller.abort = abortSpy;
      result.current.abortRef.current = controller;
    });

    act(() => {
      result.current.baseStopStreaming();
    });

    expect(abortSpy).toHaveBeenCalled();
  });

  it("reinitializes on key change", () => {
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useStreamCore(deps),
      { initialProps: { deps: ["key-1"] } },
    );

    expect(result.current.key).toBe("key-1");

    rerender({ deps: ["key-2"] });

    expect(result.current.key).toBe("key-2");
    expect(useStreamStore.getState().entries["key-2"]).toBeDefined();
  });

  it("cleans up animation frames on unmount", () => {
    const cancelRAF = vi.spyOn(globalThis, "cancelAnimationFrame");

    const { result, unmount } = renderHook(() => useStreamCore(["test"]));
    result.current.refs.raf.current = 42;

    unmount();

    expect(cancelRAF).toHaveBeenCalledWith(42);
    cancelRAF.mockRestore();
  });
});
