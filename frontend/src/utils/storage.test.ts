import { getLastAgent, setLastAgent, clearLastAgentIf } from "./storage";

const LAST_AGENT_KEY = "aura-last-agent";

describe("storage", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getLastAgent", () => {
    it("returns null when no data stored", () => {
      expect(getLastAgent()).toBeNull();
    });

    it("returns parsed agent data", () => {
      store[LAST_AGENT_KEY] = JSON.stringify({
        projectId: "p1",
        agentInstanceId: "ai-1",
      });
      const result = getLastAgent();
      expect(result).toEqual({ projectId: "p1", agentInstanceId: "ai-1" });
    });

    it("returns null for malformed JSON", () => {
      store[LAST_AGENT_KEY] = "not-json";
      expect(getLastAgent()).toBeNull();
    });

    it("returns null when parsed object is missing required fields", () => {
      store[LAST_AGENT_KEY] = JSON.stringify({ projectId: "p1" });
      expect(getLastAgent()).toBeNull();
    });

    it("returns null for empty object", () => {
      store[LAST_AGENT_KEY] = "{}";
      expect(getLastAgent()).toBeNull();
    });
  });

  describe("setLastAgent", () => {
    it("stores the agent data in localStorage", () => {
      setLastAgent("p1", "ai-1");
      expect(localStorage.setItem).toHaveBeenCalledWith(
        LAST_AGENT_KEY,
        JSON.stringify({ projectId: "p1", agentInstanceId: "ai-1" }),
      );
    });
  });

  describe("clearLastAgentIf", () => {
    it("clears when projectId matches", () => {
      store[LAST_AGENT_KEY] = JSON.stringify({
        projectId: "p1",
        agentInstanceId: "ai-1",
      });
      clearLastAgentIf({ projectId: "p1" });
      expect(localStorage.removeItem).toHaveBeenCalledWith(LAST_AGENT_KEY);
    });

    it("clears when agentInstanceId matches", () => {
      store[LAST_AGENT_KEY] = JSON.stringify({
        projectId: "p1",
        agentInstanceId: "ai-1",
      });
      clearLastAgentIf({ agentInstanceId: "ai-1" });
      expect(localStorage.removeItem).toHaveBeenCalledWith(LAST_AGENT_KEY);
    });

    it("does not clear when nothing matches", () => {
      store[LAST_AGENT_KEY] = JSON.stringify({
        projectId: "p1",
        agentInstanceId: "ai-1",
      });
      clearLastAgentIf({ projectId: "p2" });
      expect(localStorage.removeItem).not.toHaveBeenCalled();
    });

    it("handles missing localStorage data gracefully", () => {
      expect(() => clearLastAgentIf({ projectId: "p1" })).not.toThrow();
    });

    it("handles malformed JSON gracefully", () => {
      store[LAST_AGENT_KEY] = "bad-json";
      expect(() => clearLastAgentIf({ projectId: "p1" })).not.toThrow();
    });
  });
});
