import { createContext, useContext, useCallback, useRef, useEffect } from "react";
import type { EngineEvent, EngineEventType } from "../types/events";
import { useEventStream } from "../hooks/use-event-stream";

type EventCallback = (event: EngineEvent) => void;

interface EventContextValue {
  connected: boolean;
  events: EngineEvent[];
  latestEvent: EngineEvent | null;
  subscribe: (type: EngineEventType, callback: EventCallback) => () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: React.ReactNode }) {
  const stream = useEventStream();
  const subscribersRef = useRef<Map<EngineEventType, Set<EventCallback>>>(new Map());
  const lastDispatchedRef = useRef(0);

  useEffect(() => {
    const all = stream.events;
    const start = lastDispatchedRef.current;
    if (all.length <= start) return;
    for (let i = start; i < all.length; i++) {
      const event = all[i];
      const subs = subscribersRef.current.get(event.type);
      if (subs) subs.forEach((cb) => cb(event));
    }
    lastDispatchedRef.current = all.length;
  }, [stream.events]);

  const subscribe = useCallback(
    (type: EngineEventType, callback: EventCallback) => {
      const map = subscribersRef.current;
      if (!map.has(type)) {
        map.set(type, new Set());
      }
      map.get(type)!.add(callback);

      return () => {
        map.get(type)?.delete(callback);
      };
    },
    [],
  );

  return (
    <EventContext.Provider
      value={{
        connected: stream.connected,
        events: stream.events,
        latestEvent: stream.latestEvent,
        subscribe,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error("useEventContext must be used within an EventProvider");
  }
  return ctx;
}
