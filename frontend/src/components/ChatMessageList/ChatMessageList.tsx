import type { ReactNode } from "react";
import { MessageBubble, StreamingBubble } from "../MessageBubble";
import { CookingIndicator } from "../CookingIndicator";
import {
  useStreamMessages,
  useIsStreaming,
  useStreamingText,
  useThinkingText,
  useThinkingDurationMs,
  useActiveToolCalls,
  useTimeline,
  useProgressText,
} from "../../hooks/stream/hooks";

interface ChatMessageListProps {
  streamKey: string;
  emptyState?: ReactNode;
}

export function ChatMessageList({ streamKey, emptyState }: ChatMessageListProps) {
  const messages = useStreamMessages(streamKey);
  const isStreaming = useIsStreaming(streamKey);
  const streamingText = useStreamingText(streamKey);
  const thinkingText = useThinkingText(streamKey);
  const thinkingDurationMs = useThinkingDurationMs(streamKey);
  const activeToolCalls = useActiveToolCalls(streamKey);
  const timeline = useTimeline(streamKey);
  const progressText = useProgressText(streamKey);

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
