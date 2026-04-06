import { useMemo } from "react";
import type { ProcessEvent } from "../../../../types";
import type { DisplaySessionEvent, TimelineItem } from "../../../../types/stream";
import { MessageBubble } from "../../../../components/MessageBubble";
import { contentBlocksToTimeline } from "../NodeOutputTab/node-output-utils";

interface Props {
  event: ProcessEvent;
}

export function ProcessEventOutput({ event }: Props) {
  const message = useMemo(() => processEventToMessage(event), [event]);
  if (!message) return null;
  return <MessageBubble message={message} />;
}

function processEventToMessage(event: ProcessEvent): DisplaySessionEvent | null {
  const hasBlocks = !!event.content_blocks && event.content_blocks.length > 0;
  const { timeline, toolCalls, thinkingText } = hasBlocks
    ? contentBlocksToTimeline(event.content_blocks!)
    : { timeline: [] as TimelineItem[], toolCalls: [], thinkingText: "" };

  // Ensure `event.output` still appears when blocks only contain tools/thinking.
  if (
    event.output &&
    timeline.length > 0 &&
    !timeline.some((item) => item.kind === "text")
  ) {
    timeline.push({
      kind: "text",
      content: event.output,
      id: "node-output",
    });
  }

  const hasContent = !!(event.output || timeline.length > 0 || thinkingText);
  if (!hasContent) return null;

  return {
    id: event.event_id,
    role: "assistant",
    content: event.output || "",
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    thinkingText: thinkingText || undefined,
    timeline: timeline.length > 0 ? timeline : undefined,
  };
}
