import { useEffect, useRef, useState, useCallback } from "react";
import { useEventContext } from "../context/EventContext";
import { formatTime } from "../utils/format";
import { LOG_MAX_LINES } from "../constants";

export interface LogEntry {
  timestamp: string;
  message: string;
  isEvent: boolean;
}

export function useLogStream() {
  const { subscribe } = useEventContext();
  const [lines, setLines] = useState<LogEntry[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const addLine = useCallback((message: string, isEvent = false) => {
    setLines((prev) => {
      const entry: LogEntry = {
        timestamp: formatTime(new Date()),
        message,
        isEvent,
      };
      const next = [...prev, entry];
      return next.length > LOG_MAX_LINES ? next.slice(-LOG_MAX_LINES) : next;
    });
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribe("log_line", (e) => {
        addLine(e.message || "", false);
      }),
      subscribe("task_started", (e) => {
        addLine(`Started: ${e.task_title || e.task_id}`, true);
      }),
      subscribe("task_completed", (e) => {
        addLine(`Completed: ${e.task_id}`, true);
      }),
      subscribe("task_failed", (e) => {
        addLine(`Failed: ${e.task_id} — ${e.reason || "unknown"}`, true);
      }),
      subscribe("session_rolled_over", (e) => {
        addLine(
          `Context rotated → Session ${e.new_session_id?.slice(0, 8)}`,
          true,
        );
      }),
      subscribe("loop_started", () => {
        addLine("Dev loop started", true);
      }),
      subscribe("loop_paused", (e) => {
        addLine(`Loop paused (${e.completed_count} completed)`, true);
      }),
      subscribe("loop_stopped", (e) => {
        addLine(`Loop stopped (${e.completed_count} completed)`, true);
      }),
      subscribe("loop_finished", (e) => {
        addLine(`Loop finished: ${e.outcome}`, true);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [subscribe, addLine]);

  useEffect(() => {
    if (autoScrollRef.current && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines]);

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  }, []);

  return { lines, contentRef, handleScroll };
}
