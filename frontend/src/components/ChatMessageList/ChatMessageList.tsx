import type { ReactNode } from "react";
import type { DisplayMessage, ToolCallEntry, TimelineItem } from "../../types/stream";
import { MessageBubble, StreamingBubble } from "../MessageBubble";
import { CookingIndicator } from "../CookingIndicator";

interface ChatMessageListProps {
  messages: DisplayMessage[];
  isStreaming: boolean;
  streamingText: string;
  thinkingText: string;
  thinkingDurationMs: number | null;
  activeToolCalls: ToolCallEntry[];
  timeline: TimelineItem[];
  progressText: string;
  emptyState?: ReactNode;
}

export function ChatMessageList({
  messages,
  isStreaming,
  streamingText,
  thinkingText,
  thinkingDurationMs,
  activeToolCalls,
  timeline,
  progressText,
  emptyState,
}: ChatMessageListProps) {
  const hasMessages = messages.length > 0 || isStreaming || streamingText || thinkingText;

  if (!hasMessages) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && !streamingText && !thinkingText && activeToolCalls.length === 0 && (
        <CookingIndicator label={progressText || "Cooking..."} />
      )}
      {(streamingText || thinkingText || activeToolCalls.length > 0) && (
        <StreamingBubble
          text={streamingText}
          toolCalls={activeToolCalls}
          thinkingText={thinkingText}
          thinkingDurationMs={thinkingDurationMs}
          timeline={timeline}
          progressText={progressText}
        />
      )}
    </>
  );
}
