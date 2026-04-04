import { useEffect, useRef } from "react";
import { useEventStore } from "../stores/event-store";
import { EventType } from "../types/aura-events";
import {
  useStreamCore,
  handleTextDelta,
  handleThinkingDelta,
  handleToolCallStarted,
  handleToolResult,
  resetStreamBuffers,
  finalizeStream,
} from "./use-stream-core";
import { getThinkingDurationMs } from "./stream/store";

/**
 * Bridges process node execution events into the shared stream store,
 * reusing the same handlers and rendering path as the task/chat UI.
 *
 * All harness event types (text, thinking, tool_use_start, tool_result)
 * arrive as `ProcessNodeOutputDelta` events with a `delta_type` discriminator.
 */
export function useProcessNodeStream(
  runId: string | undefined,
  nodeId: string | undefined,
  isActive?: boolean,
): { streamKey: string } {
  const { key, refs, setters, abortRef } = useStreamCore(["process-node", runId, nodeId]);
  const subscribe = useEventStore((s) => s.subscribe);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    if (!runId || !nodeId) return;

    if (isActive && !isStreamingRef.current) {
      setters.setIsStreaming(true);
      isStreamingRef.current = true;
    }

    const unsubs = [
      subscribe(EventType.ProcessNodeExecuted, (e) => {
        const c = e.content as unknown as Record<string, unknown>;
        if (c.run_id !== runId || c.node_id !== nodeId) return;
        const status = ((c.status as string) ?? "").toLowerCase();
        if (status.includes("running")) {
          resetStreamBuffers(refs, setters);
          setters.setIsStreaming(true);
          isStreamingRef.current = true;
        } else {
          finalizeStream(refs, setters, abortRef, isStreamingRef.current);
          isStreamingRef.current = false;
        }
      }),

      subscribe(EventType.ProcessNodeOutputDelta, (e) => {
        const c = e.content as unknown as Record<string, unknown>;
        if (c.run_id !== runId || c.node_id !== nodeId) return;

        const deltaType = (c.delta_type as string) ?? "text";

        switch (deltaType) {
          case "text": {
            const text = (c.text as string) ?? "";
            if (text) handleTextDelta(refs, setters, getThinkingDurationMs(key), text);
            break;
          }
          case "thinking": {
            const thinking = (c.thinking as string) ?? "";
            if (thinking) handleThinkingDelta(refs, setters, thinking);
            break;
          }
          case "tool_use_start": {
            handleToolCallStarted(refs, setters, {
              id: (c.id as string) ?? crypto.randomUUID(),
              name: (c.name as string) ?? "unknown",
            });
            break;
          }
          case "tool_result": {
            handleToolResult(refs, setters, {
              id: c.id as string | undefined,
              name: (c.name as string) ?? "unknown",
              result: (c.result as string) ?? "",
              is_error: (c.is_error as boolean) ?? false,
            });
            break;
          }
        }
      }),

      subscribe(EventType.ProcessRunCompleted, (e) => {
        const c = e.content as unknown as Record<string, unknown>;
        if (c.run_id !== runId) return;
        finalizeStream(refs, setters, abortRef, isStreamingRef.current);
        isStreamingRef.current = false;
      }),

      subscribe(EventType.ProcessRunFailed, (e) => {
        const c = e.content as unknown as Record<string, unknown>;
        if (c.run_id !== runId) return;
        finalizeStream(refs, setters, abortRef, isStreamingRef.current);
        isStreamingRef.current = false;
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [runId, nodeId, isActive, key, refs, setters, abortRef, subscribe]);

  return { streamKey: key };
}
