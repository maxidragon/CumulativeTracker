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

  it("focuses the competitor search when the round opens", () => {
    renderFlow();
    expect(screen.getByLabelText("Competitor")).toHaveFocus();
  });

  it("opens a competitor from the board and updates the shared budget", async () => {
    const user = userEvent.setup();
    renderFlow();
    const competitorLinks = screen.getAllByRole("link", { name: /Example Competitor/i });
    const competitorLink = competitorLinks[0];
    if (!competitorLink) throw new Error("Competitor link was not rendered.");
    await user.click(competitorLink);
    expect(screen.getByLabelText("Competitor")).toHaveValue("Example Competitor");

    const attempt = screen.getByLabelText("Attempt 1");
    await user.click(attempt);
    await user.keyboard("100000{Enter}");

    const budget = screen.getByRole("group", { name: "Cumulative limit used and remaining" });
    await waitFor(() => expect(budget).toHaveTextContent("Remaining10:00.00"));
    expect(localStorage.getItem("ct:v1:budgets:InventedOpen2026")).toContain(
      '"centiseconds":60000',
    );
  });

  it("opens a scorecard by registrant id and returns to the search after the last attempt", async () => {
    const user = userEvent.setup();
    renderFlow();
    const search = screen.getByLabelText("Competitor");
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
    const search = screen.getByLabelText("Competitor");
    await user.click(search);
    await user.keyboard("example{ArrowDown}");
    expect(screen.getByRole("option", { name: /Example Competitor/ })).toHaveClass(
      "Mui-focused",
    );
    expect(screen.queryByRole("row", { current: true })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");

    const first = await screen.findByLabelText("Attempt 1");
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByLabelText("Attempt 2")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(search).toHaveFocus();
  });

  it("suggests an exact registrant id or names containing the text, without hiding rows", async () => {
    const [person] = wcif.persons;
    if (!person) throw new Error("Fixture competitor missing.");
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/333bf-r1", {
      ...wcif,
      persons: [
        person,
        { ...person, registrantId: 17, name: "Zoë Sample", wcaUserId: 170 },
      ],
    });
    const search = screen.getByLabelText("Competitor");

    await user.type(search, "7");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("#7"),
    ]);
    expect(screen.getAllByRole("link", { name: /Zoë Sample/ }).length).toBeGreaterThan(0);

    await user.clear(search);
    await user.type(search, "zoe");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("Zoë Sample"),
    ]);
    expect(screen.getAllByRole("link", { name: /Example Competitor/ }).length).toBeGreaterThan(0);
  });

  it("clears the competitor search with Escape", async () => {
    const user = userEvent.setup();
    renderFlow();
    const search = screen.getByLabelText("Competitor");
    await user.type(search, "example");
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("shows the open competitor in the search and closes it from there", async () => {
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    const search = screen.getByLabelText("Competitor");
    expect(search).toHaveValue("Example Competitor");

    await user.click(screen.getByRole("button", { name: "Close competitor" }));
    expect(search).toHaveValue("");
    expect(screen.queryByLabelText("Attempt 1")).not.toBeInTheDocument();
  });

  it("closes the scorecard with Done in local mode", async () => {
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    await user.click(await screen.findByLabelText("Attempt 1"));
    await user.keyboard("40000{Enter}");
    await user.click(screen.getByRole("button", { name: "Done" }));

    const search = screen.getByLabelText("Competitor");
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(screen.queryByLabelText("Attempt 1")).not.toBeInTheDocument();
  });

  it("saves an attempt still being typed when the scorecard is confirmed", async () => {
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    await user.click(await screen.findByLabelText("Attempt 1"));
    await user.keyboard("40000");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByLabelText("Competitor")).toHaveValue("");
    expect(localStorage.getItem("ct:v1:budgets:InventedOpen2026")).toContain(
      '"centiseconds":24000',
    );
  });

  it("lists the shortcuts when ? is pressed outside a field", async () => {
    const user = userEvent.setup();
    renderFlow();
    // Focus a real element first: from the bare body, user-event hands MUI's focus trap a
    // non-element to restore focus to.
    screen.getByRole("button", { name: /Shortcuts/ }).focus();
    await user.keyboard("?");
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toHaveTextContent("DNS");
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

  it("clears every attempt of a competitor across the events of a shared limit", async () => {
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/444bf-r1+555bf-r1/7", sharedWcif);
    await user.click(await screen.findByLabelText("4x4 BLD · attempt 1"));
    await user.keyboard("40000{Enter}");
    await user.click(screen.getByLabelText("5x5 BLD · attempt 1"));
    await user.keyboard("50000{Enter}");

    await user.click(screen.getByRole("button", { name: "Clear competitor" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Clear attempts" }),
    );

    await waitFor(() => expect(screen.getByLabelText("4x4 BLD · attempt 1")).toHaveValue(""));
    expect(screen.getByLabelText("5x5 BLD · attempt 1")).toHaveValue("");
  });

  it("reorders attempts across the events of a shared limit", async () => {
    const user = userEvent.setup();
    renderFlow("/c/InventedOpen2026/g/444bf-r1+555bf-r1/7", sharedWcif);
    const sequence = () =>
      Array.from(document.querySelectorAll("[data-attempt-key]"), (row) =>
        row.getAttribute("data-attempt-key"),
      );
    await screen.findByLabelText("5x5 BLD · attempt 1");
    expect(sequence().slice(2, 4)).toEqual(["444bf-r1:3", "555bf-r1:1"]);

    await user.click(
      screen.getByRole("button", { name: "Move 5x5x5 Blindfolded attempt 1 earlier" }),
    );

    expect(sequence().slice(2, 4)).toEqual(["555bf-r1:1", "444bf-r1:3"]);

    const moved = screen.getByLabelText("5x5 BLD · attempt 1");
    await user.click(moved);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(sequence().slice(2, 4)).toEqual(["444bf-r1:3", "555bf-r1:1"]);
    expect(moved).toHaveFocus();
  });

  it("submits entered attempts to WCA Live on confirm and closes the scorecard", async () => {
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
    expect(
      fetchMock.mock.calls.some(([url]) => requestUrl(url).endsWith("/api/enter-attempt")),
    ).toBe(false);
    await user.click(screen.getByRole("button", { name: "Submit to WCA Live" }));

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
    await waitFor(() => expect(screen.getByLabelText("Competitor")).toHaveValue(""));
    expect(screen.getByLabelText("Competitor")).toHaveFocus();
    expect(screen.getAllByLabelText("On WCA Live").length).toBeGreaterThan(0);
  });

  it("resubmits an attempt changed after WCA Live had it, on confirm", async () => {
    useAuthStore.setState({
      session: { accessToken: "wca-session", expiresAt: "2099-01-01T00:00:00.000Z" },
      error: null,
    });
    saveScoretakingToken(wcif.id, "scoretaking-token");
    useTrackingStore.getState().setLiveEnabled(wcif.id, true);
    const liveResults = {
      events: [
        {
          eventId: "333bf",
          rounds: [{ number: 1, results: [{ personId: 7, attempts: [30_000, 0, 0] }] }],
        },
      ],
    };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) =>
      Promise.resolve(
        requestUrl(input).endsWith("/api/enter-attempt")
          ? new Response(null, { status: 200 })
          : new Response(JSON.stringify(liveResults), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Attempt 1");
    await waitFor(() => expect(input).toHaveValue("5:00.00"));
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}100000{Enter}");
    await user.click(screen.getByRole("button", { name: "Submit to WCA Live" }));

    await waitFor(() => expect(screen.getByLabelText("Competitor")).toHaveValue(""));
    const posts = fetchMock.mock.calls.filter(([url]) =>
      requestUrl(url).endsWith("/api/enter-attempt"),
    ) as unknown as [string, RequestInit][];
    expect(posts.map(([, init]) => JSON.parse(init.body as string) as unknown)).toEqual([
      expect.objectContaining({ attemptNumber: 1, attemptResult: 60_000 }),
    ]);
  });

  it("shows a DNF's newly entered elapsed time in the table after confirming", async () => {
    useAuthStore.setState({
      session: { accessToken: "wca-session", expiresAt: "2099-01-01T00:00:00.000Z" },
      error: null,
    });
    saveScoretakingToken(wcif.id, "scoretaking-token");
    useTrackingStore.getState().setLiveEnabled(wcif.id, true);
    const liveResults = {
      events: [
        {
          eventId: "333bf",
          rounds: [{ number: 1, results: [{ personId: 7, attempts: [-1, 0, 0] }] }],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation((input) =>
        Promise.resolve(
          requestUrl(input).endsWith("/api/enter-attempt")
            ? new Response(null, { status: 200 })
            : new Response(JSON.stringify(liveResults), { status: 200 }),
        ),
      ),
    );

    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    const user = userEvent.setup();
    expect(await screen.findByText("Elapsed time not recorded")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Attempt 1"));
    await user.keyboard("40000");
    await user.click(screen.getByRole("button", { name: "Submit to WCA Live" }));

    await waitFor(() => expect(screen.getByLabelText("Competitor")).toHaveValue(""));
    const row = screen.getAllByRole("row").find((candidate) =>
      within(candidate).queryByText(/Example Competitor/),
    );
    if (!row) throw new Error("Competitor row missing.");
    expect(row).toHaveTextContent("DNF (4:00.00)");
  });

  it("keeps a DNF submitted over a solved attempt instead of reverting to the old time", async () => {
    useAuthStore.setState({
      session: { accessToken: "wca-session", expiresAt: "2099-01-01T00:00:00.000Z" },
      error: null,
    });
    saveScoretakingToken(wcif.id, "scoretaking-token");
    useTrackingStore.getState().setLiveEnabled(wcif.id, true);
    let firstAttempt = 6_000;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation((input, init) => {
        if (requestUrl(input).endsWith("/api/enter-attempt")) {
          firstAttempt = (JSON.parse(init?.body as string) as { attemptResult: number })
            .attemptResult;
          return Promise.resolve(new Response(null, { status: 200 }));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              events: [
                {
                  eventId: "333bf",
                  rounds: [
                    { number: 1, results: [{ personId: 7, attempts: [firstAttempt, 0, 0] }] },
                  ],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }),
    );

    renderFlow("/c/InventedOpen2026/g/333bf-r1/7");
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Attempt 1");
    await waitFor(() => expect(input).toHaveValue("1:00.00"));
    await user.click(input);
    await user.keyboard("d");
    await user.click(screen.getByRole("button", { name: "Submit to WCA Live" }));

    await waitFor(() => expect(screen.getByLabelText("Competitor")).toHaveValue(""));
    expect(firstAttempt).toBe(-1);
    const row = screen.getAllByRole("row").find((candidate) =>
      within(candidate).queryByText(/Example Competitor/),
    );
    if (!row) throw new Error("Competitor row missing.");
    expect(row).toHaveTextContent("DNF (1:00.00)");
  });

  it("clears a competitor on WCA Live too, across a shared limit, on confirm", async () => {
    useAuthStore.setState({
      session: { accessToken: "wca-session", expiresAt: "2099-01-01T00:00:00.000Z" },
      error: null,
    });
    saveScoretakingToken(wcif.id, "scoretaking-token");
    useTrackingStore.getState().setLiveEnabled(wcif.id, true);
    const remote: Record<string, number> = { "444bf": 6_000, "555bf": 7_000 };
    const posts: { eventId: string; attemptNumber: number; attemptResult: number }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation((input, init) => {
        if (requestUrl(input).endsWith("/api/enter-attempt")) {
          const body = JSON.parse(init?.body as string) as (typeof posts)[number];
          posts.push(body);
          remote[body.eventId] = body.attemptResult;
          return Promise.resolve(new Response(null, { status: 200 }));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              events: Object.entries(remote).map(([eventId, first]) => ({
                eventId,
                rounds: [{ number: 1, results: [{ personId: 7, attempts: [first, 0, 0] }] }],
              })),
            }),
            { status: 200 },
          ),
        );
      }),
    );

    renderFlow("/c/InventedOpen2026/g/444bf-r1+555bf-r1/7", sharedWcif);
    const user = userEvent.setup();
    const fourBld = await screen.findByLabelText("4x4 BLD · attempt 1");
    await waitFor(() => expect(fourBld).toHaveValue("1:00.00"));

    await user.click(screen.getByRole("button", { name: "Clear competitor" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Clear attempts" }),
    );
    await waitFor(() => expect(screen.getByLabelText("4x4 BLD · attempt 1")).toHaveValue(""));
    expect(screen.getByLabelText("5x5 BLD · attempt 1")).toHaveValue("");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Submit to WCA Live" }));
    await waitFor(() => expect(screen.getByLabelText("Competitor")).toHaveValue(""));
    expect(posts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventId: "444bf", attemptNumber: 1, attemptResult: 0 }),
        expect.objectContaining({ eventId: "555bf", attemptNumber: 1, attemptResult: 0 }),
      ]),
    );
    expect(posts).toHaveLength(2);
  });
});
