import type { Message } from "../types";
import type { DisplayMessage } from "../types/stream";
import { extractToolCalls, extractArtifactRefs } from "./chat-history";

export function buildDisplayMessages(msgs: Message[]): DisplayMessage[] {
  return msgs
    .filter(
      (m) =>
        (m.content && m.content.trim().length > 0) ||
        (m.content_blocks && m.content_blocks.length > 0) ||
        m.thinking,
    )
    .map((m) => {
      const allBlocks = m.content_blocks ?? [];
      const displayBlocks = allBlocks
        .filter((b) => b.type === "text" || b.type === "image")
        .map((b) =>
          b.type === "text"
            ? { type: "text" as const, text: b.text ?? "" }
            : { type: "image" as const, media_type: b.media_type ?? "image/png", data: b.data ?? "" },
        );
      return {
        id: m.message_id,
        role: m.role,
        content: m.content,
        contentBlocks: displayBlocks.length > 0 ? displayBlocks : undefined,
        toolCalls: extractToolCalls(allBlocks),
        artifactRefs: extractArtifactRefs(allBlocks),
        thinkingText: m.thinking || undefined,
        thinkingDurationMs: m.thinking_duration_ms ?? null,
      };
    });
}
