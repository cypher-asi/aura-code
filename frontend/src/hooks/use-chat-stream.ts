import { useRef, useState, useCallback } from "react";
import { api } from "../api/client";
import { useSidekick } from "../context/SidekickContext";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface UseChatStreamOptions {
  projectId: string | undefined;
  chatSessionId: string | undefined;
}

export function useChatStream({ projectId, chatSessionId }: UseChatStreamOptions) {
  const sidekick = useSidekick();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const resetMessages = useCallback((msgs: DisplayMessage[]) => {
    setMessages(msgs);
  }, []);

  const sendMessage = useCallback(
    async (content: string, action: string | null = null, selectedModel: string) => {
      if (!projectId || !chatSessionId || isStreaming) return;
      const trimmed = content.trim();
      if (!trimmed && !action) return;

      const userMsg: DisplayMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: trimmed || (action === "generate_specs" ? "Generate specs for this project" : trimmed),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      sidekick.setStreamingSessionId(chatSessionId);
      setStreamingText("");
      streamBufferRef.current = "";

      if (action === "generate_specs") {
        sidekick.clearGeneratedArtifacts();
        sidekick.setActiveTab("specs");
      }

      const controller = new AbortController();
      abortRef.current = controller;

      await api.sendMessageStream(
        projectId,
        chatSessionId,
        userMsg.content,
        action,
        selectedModel,
        {
          onDelta(text) {
            streamBufferRef.current += text;
            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                setStreamingText(streamBufferRef.current);
              });
            }
          },
          onSpecSaved(spec) {
            sidekick.pushSpec(spec);
          },
          onTaskSaved(task) {
            sidekick.pushTask(task);
          },
          onMessageSaved(msg) {
            setMessages((prev) => [
              ...prev,
              { id: msg.message_id, role: "assistant", content: msg.content },
            ]);
            setStreamingText("");
            streamBufferRef.current = "";
          },
          onTitleUpdated(session) {
            sidekick.notifySessionTitleUpdate(session);
          },
          onError(message) {
            console.error("Chat stream error:", message);
            if (streamBufferRef.current) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `error-${Date.now()}`,
                  role: "assistant",
                  content: streamBufferRef.current + `\n\n*Error: ${message}*`,
                },
              ]);
            }
            setStreamingText("");
            streamBufferRef.current = "";
          },
          onDone() {
            if (streamBufferRef.current && !isStreaming) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `stream-${Date.now()}`,
                  role: "assistant",
                  content: streamBufferRef.current,
                },
              ]);
              setStreamingText("");
              streamBufferRef.current = "";
            }
            setIsStreaming(false);
            sidekick.setStreamingSessionId(null);
            abortRef.current = null;
          },
        },
        controller.signal,
      );

      setIsStreaming(false);
      sidekick.setStreamingSessionId(null);
      abortRef.current = null;
    },
    [projectId, chatSessionId, isStreaming, sidekick],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    if (streamBufferRef.current) {
      setMessages((prev) => [
        ...prev,
        {
          id: `stopped-${Date.now()}`,
          role: "assistant",
          content: streamBufferRef.current,
        },
      ]);
    }
    setStreamingText("");
    streamBufferRef.current = "";
    setIsStreaming(false);
    sidekick.setStreamingSessionId(null);
    abortRef.current = null;
  }, [sidekick]);

  return {
    messages,
    isStreaming,
    streamingText,
    sendMessage,
    stopStreaming,
    resetMessages,
    rafRef,
  };
}
