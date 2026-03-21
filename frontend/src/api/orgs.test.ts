import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { orgsApi } from "./orgs";
import { ApiClientError } from "./core";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: { get: (k: string) => k.toLowerCase() === "content-type" ? "application/json" : null },
    json: () => Promise.resolve(body),
  }) as unknown as typeof globalThis.fetch;
}

describe("orgsApi", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("list fetches GET /api/orgs", async () => {
    const fetchMock = mockFetch(200, [{ id: "o1", name: "Org" }]);
    globalThis.fetch = fetchMock;
    const result = await orgsApi.list();
    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs", expect.any(Object));
  });

  it("create sends POST with name", async () => {
    const fetchMock = mockFetch(200, { id: "o1", name: "New Org" });
    globalThis.fetch = fetchMock;
    await orgsApi.create("New Org");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "New Org" }) }),
    );
  });

  it("get fetches by orgId", async () => {
    const fetchMock = mockFetch(200, { id: "o1" });
    globalThis.fetch = fetchMock;
    await orgsApi.get("o1");
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o1", expect.any(Object));
  });

  it("update sends PUT with name", async () => {
    const fetchMock = mockFetch(200, { id: "o1", name: "Updated" });
    globalThis.fetch = fetchMock;
    await orgsApi.update("o1", "Updated");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/o1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ name: "Updated" }) }),
    );
  });

  it("listMembers fetches members", async () => {
    const fetchMock = mockFetch(200, []);
    globalThis.fetch = fetchMock;
    await orgsApi.listMembers("o1");
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o1/members", expect.any(Object));
  });

  it("updateMemberRole sends PUT with role", async () => {
    const fetchMock = mockFetch(200, { user_id: "u1", role: "admin" });
    globalThis.fetch = fetchMock;
    await orgsApi.updateMemberRole("o1", "u1", "admin" as string);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/o1/members/u1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ role: "admin" }) }),
    );
  });

  it("removeMember sends DELETE", async () => {
    const fetchMock = mockFetch(204, null);
    globalThis.fetch = fetchMock;
    await orgsApi.removeMember("o1", "u1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/o1/members/u1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("createInvite sends POST", async () => {
    const fetchMock = mockFetch(200, { id: "inv1", token: "tok" });
    globalThis.fetch = fetchMock;
    await orgsApi.createInvite("o1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/o1/invites",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("listInvites fetches invites", async () => {
    const fetchMock = mockFetch(200, []);
    globalThis.fetch = fetchMock;
    await orgsApi.listInvites("o1");
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o1/invites", expect.any(Object));
  });

  it("revokeInvite sends DELETE", async () => {
    const fetchMock = mockFetch(204, null);
    globalThis.fetch = fetchMock;
    await orgsApi.revokeInvite("o1", "inv1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/o1/invites/inv1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("acceptInvite sends POST with token", async () => {
    const fetchMock = mockFetch(200, { user_id: "u1" });
    globalThis.fetch = fetchMock;
    await orgsApi.acceptInvite("tok123");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/invites/tok123/accept",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("getBilling fetches billing", async () => {
    const fetchMock = mockFetch(200, { plan: "pro" });
    globalThis.fetch = fetchMock;
    await orgsApi.getBilling("o1");
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o1/billing", expect.any(Object));
  });

  it("setBilling sends PUT", async () => {
    const fetchMock = mockFetch(200, { id: "o1" });
    globalThis.fetch = fetchMock;
    await orgsApi.setBilling("o1", "billing@co.com", "enterprise");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/o1/billing",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ billing_email: "billing@co.com", plan: "enterprise" }),
      }),
    );
  });

  it("getCreditTiers fetches tiers", async () => {
    const fetchMock = mockFetch(200, [{ id: "t1", credits: 100 }]);
    globalThis.fetch = fetchMock;
    await orgsApi.getCreditTiers("o1");
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o1/credits/tiers", expect.any(Object));
  });

  it("getCreditBalance fetches balance", async () => {
    const fetchMock = mockFetch(200, { credits: 500 });
    globalThis.fetch = fetchMock;
    await orgsApi.getCreditBalance("o1");
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o1/credits/balance", expect.any(Object));
  });

  it("createCreditCheckout sends POST with tier_id and credits", async () => {
    const fetchMock = mockFetch(200, { url: "https://checkout.stripe.com/session" });
    globalThis.fetch = fetchMock;
    await orgsApi.createCreditCheckout("o1", "t1", 1000);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orgs/o1/credits/checkout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tier_id: "t1", credits: 1000 }),
      }),
    );
  });

  it("throws ApiClientError on failure", async () => {
    globalThis.fetch = mockFetch(403, { error: "Forbidden", code: "forbidden", details: null });
    await expect(orgsApi.get("o1")).rejects.toThrow(ApiClientError);
  });
});
