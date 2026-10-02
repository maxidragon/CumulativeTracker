import type { Competition } from "@wca/helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroupScreen } from "./GroupScreen";
import { useTrackingStore } from "./trackingStore";
import { useAuthStore } from "../auth/store";
import { forgetScoretakingToken, saveScoretakingToken } from "../../lib/wcaLive";

const wcif = {
  id: "InventedOpen2026",
  name: "Invented Open 2026",
  persons: [
    {
      registrantId: 7,
      name: "Example Competitor",
      wcaUserId: 70,
      countryIso2: "PL",
      registration: {
        wcaRegistrationId: 700,
        eventIds: ["333bf"],
        status: "accepted",
        isCompeting: true,
      },
      extensions: [],
    },
  ],
  events: [
    {
      id: "333bf",
      rounds: [
        {
          id: "333bf-r1",
          format: "3",
          timeLimit: { centiseconds: 120_000, cumulativeRoundIds: ["333bf-r1"] },
          cutoff: null,
          advancementCondition: null,
          results: [],
          extensions: [],
        },
      ],
      extensions: [],
    },
  ],
} as unknown as Competition;

const sharedLimitRound = (id: string) => ({
  id,
  format: "3",
  timeLimit: { centiseconds: 360_000, cumulativeRoundIds: ["444bf-r1", "555bf-r1"] },
  cutoff: null,
  advancementCondition: null,
  results: [],
  extensions: [],
});

const sharedWcif = {
  ...wcif,
  persons: wcif.persons.map((person) => ({
    ...person,
    registration: { ...person.registration, eventIds: ["444bf", "555bf"] },
  })),
  events: [
    { id: "444bf", rounds: [sharedLimitRound("444bf-r1")], extensions: [] },
    { id: "555bf", rounds: [sharedLimitRound("555bf-r1")], extensions: [] },
  ],
} as unknown as Competition;

function renderFlow(
  initialEntry = "/c/InventedOpen2026/g/333bf-r1",
  competition: Competition = wcif,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(["wcif", competition.id], {
    wcif: competition,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    fromCache: false,
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            element={<GroupScreen />}
            path="/c/:competitionId/g/:groupKey/:registrantId?"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("local competition flow", () => {
  beforeEach(() => {
    localStorage.clear();
    useTrackingStore.setState({ competitions: {} });
    useAuthStore.setState({ session: null, error: null });
  });

  afterEach(() => {
    forgetScoretakingToken(wcif.id);
    vi.unstubAllGlobals();
  });

  it("opens a competitor from the board and updates the shared budget", async () => {
    const user = userEvent.setup();
    renderFlow();
    const competitorLinks = screen.getAllByRole("link", { name: /Example Competitor/i });
    const competitorLink = competitorLinks[0];
    if (!competitorLink) throw new Error("Competitor link was not rendered.");
    await user.click(competitorLink);
    expect(
      screen.getByRole("heading", { name: /Example Competitor/i }),
    ).toBeInTheDocument();

    const attempt = screen.getByLabelText("Attempt 1");
    await user.click(attempt);
    await user.keyboard("100000{Enter}");

    const capCard = screen.getByText("Next attempt cap").parentElement;
    if (!capCard) throw new Error("Cap card was not rendered.");
    await waitFor(() => expect(within(capCard).getByText("10:00")).toBeInTheDocument());
    expect(localStorage.getItem("ct:v1:budgets:InventedOpen2026")).toContain(
      '"centiseconds":60000',
    );
  });

  it("opens a scorecard by registrant id and returns to the search after the last attempt", async () => {
    const user = userEvent.setup();
    renderFlow();
    const search = screen.getByLabelText("Find competitor (registrant id or name)");
    await user.click(search);
    await user.keyboard("7{Enter}");

    const first = await screen.findByLabelText("Attempt 1");
    expect(first).toHaveFocus();
    await user.keyboard("40000{Enter}40000{Enter}");
    expect(screen.getByLabelText("Attempt 3")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(search).toHaveFocus();
  });

  it("picks a search match with the arrow keys and returns to the search with Escape", async () => {
    const user = userEvent.setup();
    renderFlow();
    const search = screen.getByLabelText("Find competitor (registrant id or name)");
    await user.click(search);
    await user.keyboard("example{ArrowDown}");
    expect(
      screen.getByRole("row", { current: true, name: /Example Competitor/ }),
    ).toBeInTheDocument();
    await user.keyboard("{Enter}");

    const first = await screen.findByLabelText("Attempt 1");
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByLabelText("Attempt 2")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(search).toHaveFocus();
  });

  it("lists the shortcuts when ? is pressed outside a field", async () => {
    const user = userEvent.setup();
    renderFlow();
    // Focus a real element first: from the bare body, user-event hands MUI's focus trap a
    // non-element to restore focus to.
    screen.getByRole("button", { name: /Shortcuts/ }).focus();
    await user.keyboard("?");
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toHaveTextContent("Toggle estimated");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("keeps the scorecard usable when an attempt overruns the whole budget", async () => {
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    const attempt = await screen.findByLabelText("Attempt 1");
    await user.click(attempt);
    await user.keyboard("250000{Enter}");

    expect(
      await screen.findByText("The cumulative limit is exhausted."),
    ).toBeInTheDocument();
  });

  it("reorders attempts across the events of a shared limit", async () => {
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/444bf-r1+555bf-r1/7", sharedWcif);
    const sequence = () =>
      Array.from(document.querySelectorAll("[data-attempt-key]"), (row) =>
        row.getAttribute("data-attempt-key"),
      );
    await screen.findByLabelText("555bf · attempt 1");
    expect(sequence().slice(2, 4)).toEqual(["444bf-r1:3", "555bf-r1:1"]);

    await user.click(
      screen.getByRole("button", { name: "Move 5x5x5 Blindfolded attempt 1 earlier" }),
    );

    expect(sequence().slice(2, 4)).toEqual(["555bf-r1:1", "444bf-r1:3"]);

    const moved = screen.getByLabelText("555bf · attempt 1");
    await user.click(moved);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(sequence().slice(2, 4)).toEqual(["444bf-r1:3", "555bf-r1:1"]);
    expect(moved).toHaveFocus();
  });

  it("submits a committed attempt immediately in WCA Live mode", async () => {
    useAuthStore.setState({
      session: {
        accessToken: "wca-session",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      error: null,
    });
    saveScoretakingToken(wcif.id, "scoretaking-token");
    useTrackingStore.getState().setLiveEnabled(wcif.id, true);
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = requestUrl(input);
      return Promise.resolve(
        url.endsWith("/api/enter-attempt")
          ? new Response(null, { status: 200 })
          : new Response(JSON.stringify({ events: [] }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Attempt 1");
    await user.click(input);
    await user.keyboard("100000{Enter}");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          requestUrl(url).endsWith("/api/enter-attempt"),
        ),
      ).toBe(true);
    });
    const postCall = fetchMock.mock.calls.find(([url]) =>
      requestUrl(url).endsWith("/api/enter-attempt"),
    ) as unknown as [string, RequestInit];
    if (typeof postCall[1].body !== "string") {
      throw new Error("WCA Live request body was not JSON text.");
    }
    expect(JSON.parse(postCall[1].body)).toMatchObject({
      competitionWcaId: wcif.id,
      registrantId: 7,
      attemptNumber: 1,
      attemptResult: 60_000,
    });
    const attemptRow = input.closest<HTMLElement>("[data-attempt-key]");
    if (!attemptRow) throw new Error("Attempt row was not rendered.");
    await waitFor(() =>
      expect(within(attemptRow).getByText("On WCA Live")).toBeInTheDocument(),
    );
  });
});
