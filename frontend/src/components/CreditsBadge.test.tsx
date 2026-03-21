import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CREDITS_UPDATED_EVENT } from "./CreditsBadge";

const mockGetCreditBalance = vi.fn();

vi.mock("../api/client", () => ({
  api: {
    orgs: {
      getCreditBalance: (...args: unknown[]) => mockGetCreditBalance(...args),
    },
  },
}));

const fakeSubscribe = vi.fn((_type: string, _cb: () => void) => vi.fn());

vi.mock("../stores/event-store", () => {
  const store = {
    subscribe: (...args: unknown[]) => fakeSubscribe(...args),
  };
  return {
    useEventStore: (selector: (s: typeof store) => unknown) => selector(store),
  };
});

vi.mock("../stores/org-store", () => {
  let activeOrg: { org_id: string } | null = { org_id: "org-1" };
  return {
    useOrgStore: Object.assign(
      (selector: (s: { activeOrg: typeof activeOrg }) => unknown) =>
        selector({ activeOrg }),
      {
        _setActiveOrg: (org: typeof activeOrg) => { activeOrg = org; },
      },
    ),
  };
});

vi.mock("./CreditsBadge.module.css", () => ({
  default: { creditsBadge: "creditsBadge", label: "label" },
}));

import { CreditsBadge } from "./CreditsBadge";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockGetCreditBalance.mockReset();
  fakeSubscribe.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CreditsBadge", () => {
  it("renders placeholder when balance has not loaded", () => {
    mockGetCreditBalance.mockReturnValue(new Promise(() => {}));
    render(<CreditsBadge />);
    expect(screen.getByText("--- Z")).toBeInTheDocument();
  });

  it("shows formatted credit balance after fetch resolves", async () => {
    mockGetCreditBalance.mockResolvedValue({ total_credits: 5000 });
    render(<CreditsBadge />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(screen.getByText(/5,000 Z/)).toBeInTheDocument();
    });
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockGetCreditBalance.mockResolvedValue({ total_credits: 100 });
    const handleClick = vi.fn();
    render(<CreditsBadge onClick={handleClick} />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("re-fetches when credits-updated event fires", async () => {
    mockGetCreditBalance.mockResolvedValue({ total_credits: 100 });
    render(<CreditsBadge />);
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    mockGetCreditBalance.mockResolvedValue({ total_credits: 200 });
    act(() => {
      window.dispatchEvent(new Event(CREDITS_UPDATED_EVENT));
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(screen.getByText(/200 Z/)).toBeInTheDocument();
    });
  });

  it("subscribes to task_completed and loop_finished events", () => {
    mockGetCreditBalance.mockResolvedValue({ total_credits: 0 });
    render(<CreditsBadge />);

    const subscribedEvents = fakeSubscribe.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(subscribedEvents).toContain("task_completed");
    expect(subscribedEvents).toContain("loop_finished");
  });
});
