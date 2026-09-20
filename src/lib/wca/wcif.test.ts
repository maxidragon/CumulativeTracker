import type { Competition } from "@wca/helpers";
import { describe, expect, it } from "vitest";
import {
  competitorsForGroup,
  createCompetitionBudget,
  extractCompetitionGroups,
  plansForCompetitor,
  unsupportedRounds,
} from ".";

const fixture = {
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
        eventIds: ["333bf", "444bf"],
        status: "accepted",
        isCompeting: true,
      },
      extensions: [],
    },
    {
      registrantId: 9,
      name: "Different Events",
      wcaUserId: 90,
      countryIso2: "GB",
      registration: {
        wcaRegistrationId: 900,
        eventIds: ["333"],
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
          timeLimit: {
            centiseconds: 120_000,
            cumulativeRoundIds: ["333bf-r1", "444bf-r1"],
          },
          cutoff: null,
          advancementCondition: null,
          results: [],
          extensions: [],
        },
      ],
      extensions: [],
    },
    {
      id: "444bf",
      rounds: [
        {
          id: "444bf-r1",
          format: "3",
          timeLimit: {
            centiseconds: 120_000,
            cumulativeRoundIds: ["333bf-r1", "444bf-r1"],
          },
          cutoff: null,
          advancementCondition: null,
          results: [],
          extensions: [],
        },
      ],
      extensions: [],
    },
    {
      id: "333fm",
      rounds: [
        {
          id: "333fm-r1",
          format: "m",
          timeLimit: null,
          cutoff: null,
          advancementCondition: null,
          results: [],
          extensions: [],
        },
      ],
      extensions: [],
    },
  ],
  schedule: { numberOfDays: 1, startDate: "2026-01-01", venues: [] },
  series: [],
  competitorLimit: null,
  extensions: [],
  registrationInfo: {
    openTime: null,
    closeTime: null,
    baseEntryFee: null,
    preferredCurrency: "EUR",
    onTheSpotRegistration: false,
    useWcaRegistration: true,
  },
  formatVersion: "1.0",
  shortName: "Invented Open",
} as unknown as Competition;

describe("WCIF cumulative groups", () => {
  it("deduplicates a multi-event cumulative group", () => {
    const groups = extractCompetitionGroups(fixture);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "333bf-r1+444bf-r1",
      limitCentiseconds: 120_000,
      cumulative: true,
    });
    expect(groups[0]?.rounds).toHaveLength(2);
  });

  it("selects only accepted competitors registered for the group", () => {
    const group = extractCompetitionGroups(fixture)[0];
    if (!group) throw new Error("Fixture group missing.");
    expect(competitorsForGroup(fixture, group).map(({ registrantId }) => registrantId)).toEqual([
      7,
    ]);
  });

  it("creates attempts only for rounds the competitor entered", () => {
    const group = extractCompetitionGroups(fixture)[0];
    const person = fixture.persons[0];
    if (!group || !person) throw new Error("Fixture data missing.");
    const onlyThreeBlind = {
      ...person,
      registration: { ...person.registration!, eventIds: ["333bf" as const] },
    };
    const budget = createCompetitionBudget(onlyThreeBlind, group);
    expect(budget.attempts).toHaveLength(3);
    expect(plansForCompetitor(onlyThreeBlind, group)).toMatchObject([
      { eventId: "333bf", registered: true },
      { eventId: "444bf", registered: false },
    ]);
  });

  it("reports unsupported untimed input events", () => {
    expect(unsupportedRounds(fixture).map(({ eventId }) => eventId)).toEqual(["333fm"]);
  });
});
