import type { TrackedAttempt } from "../attempt";
import type { Budget } from "../cumulative";
import type { CompetitionGroup } from "../wca";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enterLiveAttempt,
  fetchLiveResults,
  isScoretakingTokenExpired,
  maskScoretakingToken,
  reconcileLiveBudget,
  takeRemoteAttempt,
  type LiveResults,
} from ".";

const group: CompetitionGroup = {
  key: "333bf-r1",
  limitCentiseconds: 120_000,
  cumulative: true,
  rounds: [
    {
      roundId: "333bf-r1",
      eventId: "333bf",
      eventName: "3x3x3 Blindfolded",
      eventShortName: "3x3 BLD",
      roundNumber: 1,
      roundLabel: "Final",
      format: "3",
      cutoff: null,
      registered: true,
    },
  ],
};

function attempt(
  outcome: TrackedAttempt["outcome"] = "skipped",
  centiseconds: number | null = null,
): TrackedAttempt {
  return {
    roundId: "333bf-r1",
    attemptNumber: 1,
    outcome,
    centiseconds,
    estimated: false,
    order: 1,
    enteredAt: "2026-01-01T00:00:00.000Z",
  };
}

function budget(value: TrackedAttempt): Budget {
  return {
    groupKey: group.key,
    limitCentiseconds: group.limitCentiseconds,
    perAttemptLimitCentiseconds: null,
    registrantId: 7,
    attempts: [value],
  };
}

function results(result: number): LiveResults {
  return {
    events: [
      {
        eventId: "333bf",
        rounds: [{ number: 1, results: [{ personId: 7, attempts: [result] }] }],
      },
    ],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("WCA Live client", () => {
  it("loads public results", async () => {
    const value = results(6_421);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status: 200 })),
    );
    await expect(fetchLiveResults("InventedOpen2026")).resolves.toEqual(value);
  });

  it("submits exactly one attempt with the scoretaking token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const payload = {
      competitionWcaId: "InventedOpen2026",
      eventId: "333bf",
      roundNumber: 1,
      registrantId: 7,
      attemptNumber: 2,
      attemptResult: -1,
    };
    await enterLiveAttempt("score-token", payload);
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe("https://live.worldcubeassociation.org/api/enter-attempt");
    expect(request[1].method).toBe("POST");
    expect(request[1].headers).toMatchObject({ Authorization: "Bearer score-token" });
    expect(request[1].body).toBe(JSON.stringify(payload));
  });

  it.each([
    [400, "internal error"],
    [401, "Re-generate the token"],
    [404, "round is open"],
    [422, "could not accept"],
  ])("maps status %i to an actionable message", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "details" }), { status }),
      ),
    );
    await expect(
      enterLiveAttempt("score-token", {
        competitionWcaId: "InventedOpen2026",
        eventId: "333bf",
        roundNumber: 1,
        registrantId: 7,
        attemptNumber: 1,
        attemptResult: 6_421,
      }),
    ).rejects.toThrow(message);
  });
});

describe("WCA Live reconciliation", () => {
  it("imports a remote result into a skipped attempt", () => {
    const next = reconcileLiveBudget(budget(attempt()), group, results(6_421));
    expect(next.attempts[0]).toMatchObject({
      outcome: "ok",
      centiseconds: 6_421,
      syncStatus: "synced",
    });
  });

  it("keeps a DNF elapsed time when WCA Live also has DNF", () => {
    const local = { ...attempt("dnf", 60_000), syncStatus: "local" as const };
    const next = reconcileLiveBudget(budget(local), group, results(-1));
    expect(next.attempts[0]).toMatchObject({
      outcome: "dnf",
      centiseconds: 60_000,
      syncStatus: "synced",
    });
  });

  it("keeps a conflicting local value and exposes the remote value", () => {
    const local = { ...attempt("ok", 6_000), syncStatus: "local" as const };
    const next = reconcileLiveBudget(budget(local), group, results(7_000));
    expect(next.attempts[0]).toMatchObject({
      centiseconds: 6_000,
      syncStatus: "local",
      remoteResult: 7_000,
    });
  });

  it("accepts a remote edit after the local value was synced", () => {
    const local = { ...attempt("dnf", 60_000), syncStatus: "synced" as const };
    const next = reconcileLiveBudget(budget(local), group, results(7_000));
    expect(next.attempts[0]).toMatchObject({
      outcome: "ok",
      centiseconds: 7_000,
      changedRemotely: true,
    });
  });

  it("can explicitly take WCA Live while preserving a DNF elapsed time", () => {
    expect(takeRemoteAttempt(attempt("dnf", 60_000), -1)).toMatchObject({
      outcome: "dnf",
      centiseconds: 60_000,
      syncStatus: "synced",
    });
  });
});

describe("scoretaking token", () => {
  it("masks all but the last four characters", () => {
    expect(maskScoretakingToken("very-secret-token")).toBe("••••oken");
  });

  it("expires seven days after entry", () => {
    const token = { token: "secret", enteredAt: "2026-09-01T00:00:00.000Z" };
    expect(isScoretakingTokenExpired(token, Date.parse("2026-09-07T23:59:59.999Z"))).toBe(
      false,
    );
    expect(isScoretakingTokenExpired(token, Date.parse("2026-09-08T00:00:00.000Z"))).toBe(
      true,
    );
  });
});
