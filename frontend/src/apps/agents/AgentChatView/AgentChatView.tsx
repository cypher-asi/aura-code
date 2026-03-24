import { useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../../api/client";
import { useAgentChatStream } from "../../../hooks/use-agent-chat-stream";
import { useIsStreaming } from "../../../hooks/stream/hooks";
import { ChatPanel } from "../../../components/ChatPanel";
import { useChatHistoryStore, useChatHistory, agentHistoryKey } from "../../../stores/chat-history-store";
import { getStreamEntry } from "../../../hooks/stream/store";
import { useSelectedAgent, LAST_AGENT_ID_KEY } from "../stores";

export function AgentChatView() {
  const { agentId } = useParams<{ agentId: string }>();
  const historyKey = agentId ? agentHistoryKey(agentId) : undefined;
  const { selectedAgent, setSelectedAgent } = useSelectedAgent();
  const { events: historyMessages, status: historyStatus, error: historyError } = useChatHistory(historyKey);
  const showHistoryLoading = historyStatus === "loading" || historyStatus === "idle";

  const {
    streamKey,
    sendMessage,
    stopStreaming,
    resetEvents,
  } = useAgentChatStream({ agentId });
  const isStreaming = useIsStreaming(streamKey);

  const resetEventsRef = useRef(resetEvents);
  useEffect(() => { resetEventsRef.current = resetEvents; }, [resetEvents]);

  // Invalidate stale cache when streaming stops so the next navigation gets
  // fresh data even if the user leaves before the finally-block runs.
  const prevIsStreamingRef = useRef(false);
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming) {
      if (historyKey) {
        useChatHistoryStore.getState().invalidateHistory(historyKey);
      }
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, historyKey]);

  // Fetch history from the server on every agent switch.
  // Do NOT read from the manual cache — let the second effect apply data once
  // the fetch completes, avoiding stale-data flashes.
  useEffect(() => {
    if (!agentId) {
      resetEventsRef.current([], { allowWhileStreaming: true });
      return;
    }
    const key = agentHistoryKey(agentId);
    useChatHistoryStore.getState().invalidateHistory(key);
    useChatHistoryStore.getState().fetchHistory(
      key,
      () => api.agents.listEvents(agentId),
    );
    setSelectedAgent(agentId);
    localStorage.setItem(LAST_AGENT_ID_KEY, agentId);
  }, [agentId, setSelectedAgent]);

  // Sync fetched history into the stream store for rendering.
  // Skip syncing stale (invalidated) history when the stream store already
  // holds events — those are more current. A background re-fetch will
  // trigger a proper sync with fresh data shortly.
  useEffect(() => {
    if (historyStatus !== "ready" || !historyKey) return;
    const histEntry = useChatHistoryStore.getState().entries[historyKey];
    if (histEntry && histEntry.fetchedAt === 0) {
      const sEntry = getStreamEntry(streamKey);
      if (sEntry && sEntry.events.length > 0) return;
    }
    resetEventsRef.current(historyMessages, { allowWhileStreaming: true });
  }, [historyMessages, historyStatus, historyKey, streamKey]);

  // Invalidate cache before sending so navigating away mid-stream and back
  // forces a fresh fetch (mirrors ChatView.wrappedSend pattern).
  const wrappedSend = useCallback(
    (...args: Parameters<typeof sendMessage>) => {
      if (historyKey) {
        useChatHistoryStore.getState().invalidateHistory(historyKey);
      }
      return sendMessage(...args);
    },
    [sendMessage, historyKey],
  );

  const historyResolved = historyStatus === "ready" || historyStatus === "error";

  if (!agentId) return null;

  return (
    <ChatPanel
      key={agentId}
      streamKey={streamKey}
      onSend={wrappedSend}
      onStop={stopStreaming}
      agentName={selectedAgent?.name}
      isLoading={showHistoryLoading}
      historyResolved={historyResolved}
      errorMessage={historyStatus === "error" ? (historyError ?? "Failed to load conversation") : null}
      emptyMessage="Send a message"
      scrollResetKey={agentId}
    />
  );
}
