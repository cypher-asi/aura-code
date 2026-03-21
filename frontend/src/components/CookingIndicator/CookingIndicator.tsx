/* eslint-disable react-refresh/only-export-components */
import type { ToolCallEntry } from "../../types/stream";
import { TOOL_PHASE_LABELS } from "../../constants/tools";
import styles from "./CookingIndicator.module.css";

export function getStreamingPhaseLabel(state: {
  thinkingText?: string;
  streamingText: string;
  toolCalls: ToolCallEntry[];
  progressText?: string;
}): string | null {
  if (state.streamingText) return null;
  const pending = state.toolCalls.find((tc) => tc.pending);
  if (pending) return TOOL_PHASE_LABELS[pending.name] ?? "Working...";
  if (state.thinkingText) return "Thinking...";
  if (state.toolCalls.length > 0) return "Putting it all together...";
  if (state.progressText) return state.progressText;
  return "Cooking...";
}

interface CookingIndicatorProps {
  label?: string;
}

export function CookingIndicator({ label = "Cooking..." }: CookingIndicatorProps) {
  return (
    <div className={styles.cookingIndicator}>
      <span className={styles.cookingText}>{label}</span>
    </div>
  );
}
