import type { Competition } from "./types";
import { describe, expect, it } from "vitest";
import {
  competitorsForGroup,
  createCompetitionBudget,
  extractCompetitionGroups,
  groupTitle,
  plansForCompetitor,
  unsupportedRounds,
} from ".";

const fromRegistrations = {
  participationSource: { type: "registrations" },
  reservedPlaces: null,
};

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
    {
      registrantId: null,
      name: "Unregistered Organizer",
      wcaUserId: 110,
      countryIso2: "PL",
      registration: null,
      roles: ["organizer"],
      extensions: [],
    },
  ],
  events: [
    {
      id: "333bf",
      rounds: [
        {
          id: "333bf-r1",
          linkedRounds: null,
          format: "3",
          timeLimit: {
            centiseconds: 120_000,
            cumulativeRoundIds: ["333bf-r1", "444bf-r1"],
          },
          cutoff: null,
          participationRuleset: fromRegistrations,
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
          linkedRounds: null,
          format: "3",
          timeLimit: {
            centiseconds: 120_000,
            cumulativeRoundIds: ["333bf-r1", "444bf-r1"],
          },
          cutoff: null,
          participationRuleset: fromRegistrations,
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
          linkedRounds: null,
          format: "m",
          timeLimit: null,
          cutoff: null,
          participationRuleset: fromRegistrations,
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
  formatVersion: "2.2",
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

  it("selects only accepted competitors registered for the group, not unregistered staff", () => {
    const group = extractCompetitionGroups(fixture)[0];
    if (!group) throw new Error("Fixture group missing.");
    expect(competitorsForGroup(fixture, group).map(({ registrantId }) => registrantId)).toEqual([
      7,
    ]);
  });

  it("creates attempts only for rounds the competitor entered", () => {
    const group = extractCompetitionGroups(fixture)[0];
    if (!group) throw new Error("Fixture group missing.");
    const [person] = competitorsForGroup(fixture, group);
    if (!person) throw new Error("Fixture competitor missing.");
    const onlyThreeBlind = {
      ...person,
      registration: { ...person.registration, eventIds: ["333bf" as const] },
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

  it("reads the cutoff from its v2 resultValue", () => {
    const withCutoff = {
      ...fixture,
      events: [
        {
          id: "444",
          rounds: [
            {
              id: "444-r1",
              linkedRounds: null,
              format: "a",
              timeLimit: { centiseconds: 18_000, cumulativeRoundIds: [] },
              cutoff: { numberOfAttempts: 2, resultValue: 9_000 },
            },
          ],
        },
      ],
    } as unknown as Competition;
    expect(extractCompetitionGroups(withCutoff)[0]?.rounds[0]?.cutoff).toEqual({
      numberOfAttempts: 2,
      attemptResult: 9_000,
    });
  });

  it("keeps each half of a dual round as its own cumulative group", () => {
    const dualRound = (id: string) => ({
      id,
      linkedRounds: ["333bf-r1", "333bf-r2"],
      format: "5",
      timeLimit: { centiseconds: 60_000, cumulativeRoundIds: [id] },
      cutoff: null,
      participationRuleset: fromRegistrations,
    });
    const dual = {
      ...fixture,
      events: [{ id: "333bf", rounds: [dualRound("333bf-r1"), dualRound("333bf-r2")] }],
    } as unknown as Competition;

    const groups = extractCompetitionGroups(dual);
    expect(groups.map(({ key }) => key)).toEqual(["333bf-r1", "333bf-r2"]);
    for (const group of groups) {
      expect(competitorsForGroup(dual, group).map(({ registrantId }) => registrantId)).toEqual([
        7,
      ]);
    }
  });

  it("leaves Head-to-Head rounds, and any limit they share, out of the groups", () => {
    const round = (id: string, format: string, cumulativeRoundIds: string[]) => ({
      id,
      linkedRounds: null,
      format,
      timeLimit: { centiseconds: 60_000, cumulativeRoundIds },
      cutoff: null,
    });
    const headToHead = {
      ...fixture,
      events: [
        {
          id: "333",
          rounds: [
            round("333-r1", "a", []),
            round("333-r2", "h", []),
            round("333-r3", "h", ["333bf-r1", "333-r3"]),
          ],
        },
        {
          id: "333bf",
          rounds: [round("333bf-r1", "3", ["333bf-r1", "333-r3"])],
        },
        {
          id: "fto",
          rounds: [round("fto-r1", "a", [])],
        },
      ],
    } as unknown as Competition;

    expect(extractCompetitionGroups(headToHead).map(({ key }) => key)).toEqual([
      "333-r1",
      "fto-r1",
    ]);
    expect(unsupportedRounds(headToHead).map(({ roundId }) => roundId)).toEqual([
      "333-r2",
      "333-r3",
    ]);
  });

  it("titles a group with WCA Live round names", () => {
    const group = extractCompetitionGroups(fixture)[0];
    if (!group) throw new Error("Fixture group missing.");
    expect(groupTitle(group)).toBe("3x3x3 Blindfolded · Final + 4x4x4 Blindfolded · Final");
  });
});
