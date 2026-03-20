import { useEffect, useRef, useState, useCallback } from "react";
import type { EngineEvent } from "../types/events";
import { createReconnectingWebSocket } from "./ws-reconnect";
import { resolveWsUrl } from "../lib/host-config";

export interface EventStreamState {
  connected: boolean;
}

export function useEventStream(
  onEvent?: (event: EngineEvent) => void,
): EventStreamState {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<{ close: () => void } | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const handleMessage = useCallback((data: string) => {
    try {
      const event: EngineEvent = JSON.parse(data);
      onEventRef.current?.(event);
    } catch {
      // ignore malformed events
    }
  }, []);

  useEffect(() => {
    wsRef.current = createReconnectingWebSocket(
      {
        url: resolveWsUrl("/ws/events"),
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
      },
      handleMessage,
      setConnected,
    );

    return () => {
      wsRef.current?.close();
    };
  }, [handleMessage]);

  return { connected };
}
