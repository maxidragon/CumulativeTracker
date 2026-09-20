import type { Competition } from "@wca/helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CompetitionBoardScreen } from "./CompetitionBoardScreen";
import { CompetitorScreen } from "./CompetitorScreen";
import { useTrackingStore } from "./trackingStore";

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

function renderFlow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(["wcif", wcif.id], {
    wcif,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    fromCache: false,
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/c/InventedOpen2026/g/333bf-r1"]}>
        <Routes>
          <Route
            element={<CompetitionBoardScreen />}
            path="/c/:competitionId/g/:groupKey"
          />
          <Route
            element={<CompetitorScreen />}
            path="/c/:competitionId/g/:groupKey/:registrantId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("local competition flow", () => {
  beforeEach(() => {
    localStorage.clear();
    useTrackingStore.setState({ competitions: {} });
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

    const attempt = screen.getByLabelText("3x3x3 Blindfolded · attempt 1");
    await user.click(attempt);
    await user.keyboard("60000{Enter}");

    const capCard = screen.getByText("Next attempt cap").parentElement;
    if (!capCard) throw new Error("Cap card was not rendered.");
    await waitFor(() => expect(within(capCard).getByText("10:00")).toBeInTheDocument());
    expect(localStorage.getItem("ct:v1:budgets:InventedOpen2026")).toContain(
      '"centiseconds":60000',
    );
  });
});
