import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Text } from "@cypher-asi/zui";
import { MessageSquare } from "lucide-react";
import { api } from "../../api/client";
import { useAgentChatStream } from "../../hooks/use-agent-chat-stream";
import { useAutoScroll } from "../../hooks/use-auto-scroll";
import { useAgentApp } from "./AgentAppProvider";
import { buildDisplayMessages } from "../../utils/build-display-messages";
import { ChatMessageList } from "../../components/ChatMessageList";
import { ChatInputBar } from "../../components/ChatInputBar";
import type { ChatInputBarHandle, AttachmentItem } from "../../components/ChatInputBar";
import styles from "../../components/ChatView.module.css";

export function AgentChatView() {
  const { agentId } = useParams<{ agentId: string }>();
  const { agents, selectedAgent, selectAgent } = useAgentApp();

  const {
    messages,
    isStreaming,
    streamingText,
    thinkingText,
    thinkingDurationMs,
    activeToolCalls,
    timeline,
    progressText,
    sendMessage,
    stopStreaming,
    resetMessages,
  } = useAgentChatStream({ agentId });

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  const messageAreaRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<ChatInputBarHandle>(null);
  const attachmentsRef = useRef(attachments);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  const { handleScroll } = useAutoScroll(messageAreaRef, agentId);

  useEffect(() => {
    if (agentId) {
      localStorage.setItem("aura:lastAgentId", agentId);
      requestAnimationFrame(() => inputBarRef.current?.focus());
      const cachedAgent = agents.find((agent) => agent.agent_id === agentId);
      if (cachedAgent) {
        selectAgent(cachedAgent);
      }
      api.agents.get(agentId as never).then((a) => {
        selectAgent(a);
      }).catch(() => {});
    }
  }, [agentId, agents, selectAgent]);

  useEffect(() => {
    let cancelled = false;

    if (!agentId) {
      resetMessages([]);
      return;
    }
    api.agents
      .listMessages(agentId as never)
      .then((msgs) => {
        if (cancelled) return;
        resetMessages(buildDisplayMessages(msgs));
      })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [agentId, resetMessages]);

  const handleRemoveAttachment = useCallback(
    (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id)),
    [],
  );

  const handleSend = useCallback(
    (content: string, action?: string, atts?: AttachmentItem[]) => {
      setInput("");
      const toSend = atts ?? attachmentsRef.current;
      const apiAttachments = toSend.length > 0
        ? toSend.map((a) => ({
            type: a.attachmentType,
            media_type: a.mediaType,
            data: a.data,
            name: a.name,
          }))
        : undefined;
      sendMessage(content, action ?? null, null, apiAttachments);
      setAttachments([]);
    },
    [sendMessage],
  );

  if (!agentId) {
    return null;
  }

  const agentName = selectedAgent?.name;

  return (
    <div className={styles.container}>
      <div className={styles.chatArea}>
        <div
          className={styles.messageArea}
          ref={messageAreaRef}
          onScroll={handleScroll}
        >
          <div className={styles.messageContent}>
            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingText={streamingText}
              thinkingText={thinkingText}
              thinkingDurationMs={thinkingDurationMs}
              activeToolCalls={activeToolCalls}
              timeline={timeline}
              progressText={progressText}
              emptyState={
                <div className={styles.emptyState}>
                  <MessageSquare size={40} />
                  <Text variant="muted" size="sm">
                    Send a message to chat with {agentName ?? "this agent"} across all linked projects
                  </Text>
                </div>
              }
            />
          </div>
        </div>

        <ChatInputBar
          ref={inputBarRef}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          agentName={agentName}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onRemoveAttachment={handleRemoveAttachment}
        />
      </div>
    </div>
  );
}
