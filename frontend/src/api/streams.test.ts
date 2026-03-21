import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSpecsStream,
  sendAgentMessageStream,
  sendMessageStream,
} from "./streams";
import type {
  SpecGenStreamCallbacks,
  ChatStreamCallbacks,
} from "./streams";
import * as sseModule from "./sse";

vi.mock("./sse", () => ({
  streamSSE: vi.fn().mockResolvedValue(undefined),
}));

const streamSSE = sseModule.streamSSE as ReturnType<typeof vi.fn>;

describe("generateSpecsStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls streamSSE with correct URL and method", async () => {
    const cb: SpecGenStreamCallbacks = {
      onProgress: vi.fn(),
      onDelta: vi.fn(),
      onGenerating: vi.fn(),
      onSpecSaved: vi.fn(),
      onTaskSaved: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };

    await generateSpecsStream("p1" as string, cb);

    expect(streamSSE).toHaveBeenCalledOnce();
    const [url, init] = streamSSE.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/p1/specs/generate/stream");
    expect(init.method).toBe("POST");
  });

  it("passes abort signal through", async () => {
    const controller = new AbortController();
    const cb: SpecGenStreamCallbacks = {
      onProgress: vi.fn(),
      onDelta: vi.fn(),
      onGenerating: vi.fn(),
      onSpecSaved: vi.fn(),
      onTaskSaved: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };

    await generateSpecsStream("p1" as string, cb, controller.signal);
    expect(streamSSE.mock.calls[0][3]).toBe(controller.signal);
  });

  it("routes SSE events to correct callbacks", async () => {
    const cb: SpecGenStreamCallbacks = {
      onProgress: vi.fn(),
      onDelta: vi.fn(),
      onGenerating: vi.fn(),
      onSpecSaved: vi.fn(),
      onTaskSaved: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };

    await generateSpecsStream("p1" as string, cb);

    const sseCallbacks = streamSSE.mock.calls[0][2] as {
      onEvent: (type: string, data: unknown) => void;
      onError: (err: Error) => void;
    };

    sseCallbacks.onEvent("progress", { stage: "analyzing" });
    expect(cb.onProgress).toHaveBeenCalledWith("analyzing");

    sseCallbacks.onEvent("delta", { text: "chunk" });
    expect(cb.onDelta).toHaveBeenCalledWith("chunk");

    sseCallbacks.onEvent("generating", { tokens: 42 });
    expect(cb.onGenerating).toHaveBeenCalledWith(42);

    sseCallbacks.onEvent("error", { message: "fail" });
    expect(cb.onError).toHaveBeenCalledWith("fail");

    sseCallbacks.onEvent("complete", { specs: [] });
    expect(cb.onComplete).toHaveBeenCalledWith([]);
  });

  it("routes onError from SSE transport to cb.onError", async () => {
    const cb: SpecGenStreamCallbacks = {
      onProgress: vi.fn(),
      onDelta: vi.fn(),
      onGenerating: vi.fn(),
      onSpecSaved: vi.fn(),
      onTaskSaved: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };

    await generateSpecsStream("p1" as string, cb);

    const sseCallbacks = streamSSE.mock.calls[0][2] as {
      onError: (err: Error) => void;
    };
    sseCallbacks.onError(new Error("transport fail"));
    expect(cb.onError).toHaveBeenCalledWith("transport fail");
  });
});

describe("sendAgentMessageStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls streamSSE with agent message URL", async () => {
    const cb: ChatStreamCallbacks = {
      onDelta: vi.fn(),
      onError: vi.fn(),
    };

    await sendAgentMessageStream("a1", "hello", "chat", undefined, undefined, cb);

    const [url, init] = streamSSE.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/agents/a1/messages/stream");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ content: "hello", action: "chat" });
  });

  it("includes attachments in body when provided", async () => {
    const cb: ChatStreamCallbacks = {
      onDelta: vi.fn(),
      onError: vi.fn(),
    };
    const attachments = [{ type: "image" as const, media_type: "image/png", data: "base64data" }];

    await sendAgentMessageStream("a1", "look", null, undefined, attachments, cb);

    const body = JSON.parse((streamSSE.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.attachments).toEqual(attachments);
  });

  it("omits attachments from body when empty", async () => {
    const cb: ChatStreamCallbacks = {
      onDelta: vi.fn(),
      onError: vi.fn(),
    };

    await sendAgentMessageStream("a1", "hi", "ask", undefined, [], cb);

    const body = JSON.parse((streamSSE.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.attachments).toBeUndefined();
  });

  it("routes chat stream events to callbacks", async () => {
    const cb: ChatStreamCallbacks = {
      onDelta: vi.fn(),
      onThinkingDelta: vi.fn(),
      onProgress: vi.fn(),
      onToolCall: vi.fn(),
      onToolResult: vi.fn(),
      onToolCallStarted: vi.fn(),
      onTokenUsage: vi.fn(),
      onError: vi.fn(),
      onDone: vi.fn(),
    };

    await sendAgentMessageStream("a1", "hi", null, undefined, undefined, cb);

    const sseCallbacks = streamSSE.mock.calls[0][2] as {
      onEvent: (type: string, data: unknown) => void;
      onDone: () => void;
    };

    sseCallbacks.onEvent("delta", { text: "word" });
    expect(cb.onDelta).toHaveBeenCalledWith("word");

    sseCallbacks.onEvent("thinking_delta", { text: "hmm" });
    expect(cb.onThinkingDelta).toHaveBeenCalledWith("hmm");

    sseCallbacks.onEvent("token_usage", { input_tokens: 10, output_tokens: 20 });
    expect(cb.onTokenUsage).toHaveBeenCalledWith(10, 20);

    sseCallbacks.onEvent("done", {});
    expect(cb.onDone).toHaveBeenCalled();

    sseCallbacks.onDone();
    expect(cb.onDone).toHaveBeenCalledTimes(2);
  });
});

describe("sendMessageStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls streamSSE with project agent instance URL", async () => {
    const cb: ChatStreamCallbacks = {
      onDelta: vi.fn(),
      onError: vi.fn(),
    };

    await sendMessageStream("p1" as string, "ai1", "msg", "plan", undefined, undefined, cb);

    const [url, init] = streamSSE.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/p1/agents/ai1/messages/stream");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ content: "msg", action: "plan" });
  });

  it("includes attachments when provided", async () => {
    const cb: ChatStreamCallbacks = {
      onDelta: vi.fn(),
      onError: vi.fn(),
    };
    const attachments = [{ type: "text" as const, media_type: "text/plain", data: "content", name: "file.txt" }];

    await sendMessageStream("p1" as string, "ai1", "check", null, undefined, attachments, cb);

    const body = JSON.parse((streamSSE.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.attachments).toEqual(attachments);
  });

  it("passes signal through", async () => {
    const controller = new AbortController();
    const cb: ChatStreamCallbacks = {
      onDelta: vi.fn(),
      onError: vi.fn(),
    };

    await sendMessageStream("p1" as string, "ai1", "x", null, undefined, undefined, cb, controller.signal);
    expect(streamSSE.mock.calls[0][3]).toBe(controller.signal);
  });
});
