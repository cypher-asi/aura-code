import { renderHook, act } from "@testing-library/react";
import { useCheckoutPolling } from "./use-checkout-polling";

vi.mock("../api/client", () => ({
  api: {
    orgs: {
      getCreditBalance: vi.fn(),
    },
  },
}));

import { api } from "../api/client";

const mockGetBalance = vi.mocked(api.orgs.getCreditBalance);

describe("useCheckoutPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetBalance.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with idle status", () => {
    const { result } = renderHook(() => useCheckoutPolling("org-1"));

    expect(result.current.status).toBe("idle");
    expect(result.current.settledBalance).toBeNull();
  });

  it("transitions to polling on startPolling", () => {
    mockGetBalance.mockResolvedValue({
      total_credits: 100,
      purchases: [],
    });

    const { result } = renderHook(() => useCheckoutPolling("org-1"));

    act(() => {
      result.current.startPolling(100);
    });

    expect(result.current.status).toBe("polling");
  });

  it("transitions to success when balance increases with no pending", async () => {
    mockGetBalance.mockResolvedValue({
      total_credits: 200,
      purchases: [{ id: "p1", tier_id: null, credits: 100, amount_cents: 1000, status: "completed", created_at: "" }],
    });

    const { result } = renderHook(() => useCheckoutPolling("org-1"));

    await act(async () => {
      result.current.startPolling(100);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe("success");
    expect(result.current.settledBalance).toBeTruthy();
    expect(result.current.settledBalance!.total_credits).toBe(200);
  });

  it("times out after POLL_TIMEOUT_MS", async () => {
    mockGetBalance.mockResolvedValue({
      total_credits: 100,
      purchases: [],
    });

    const { result } = renderHook(() => useCheckoutPolling("org-1"));

    act(() => {
      result.current.startPolling(100);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current.status).toBe("timeout");
  });

  it("resets to idle", async () => {
    mockGetBalance.mockResolvedValue({
      total_credits: 200,
      purchases: [],
    });

    const { result } = renderHook(() => useCheckoutPolling("org-1"));

    await act(async () => {
      result.current.startPolling(100);
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.settledBalance).toBeNull();
  });

  it("does nothing when orgId is undefined", () => {
    const { result } = renderHook(() => useCheckoutPolling(undefined));

    act(() => {
      result.current.startPolling(100);
    });

    expect(result.current.status).toBe("idle");
  });
});
