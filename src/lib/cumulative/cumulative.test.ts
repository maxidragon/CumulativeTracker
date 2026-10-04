import { describe, expect, it } from "vitest";
import type { TrackedAttempt } from "../attempt";
import { autocompleteTime } from "../attempt";
import {
  attemptKey,
  attemptsLeft,
  attemptsLeftForRound,
  averageForRemainingAttempts,
  budgetBeforeAttempt,
  deriveBudget,
  dnsRemainingInRound,
  groupKey,
  isTrackableBudget,
  perAttemptLimitWarning,
  reorderAttempts,
  stopAttemptAtLimit,
  type Budget,
  type RoundPlan,
} from ".";

function tracked(
  roundId: string,
  attemptNumber: number,
  outcome: TrackedAttempt["outcome"],
  centiseconds: number | null,
  order = attemptNumber,
): TrackedAttempt {
  return {
    roundId,
    attemptNumber,
    outcome,
    centiseconds,
    estimated: false,
    order,
    enteredAt: "2026-01-01T00:00:00.000Z",
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    groupKey: "333bf-r1",
    limitCentiseconds: 180_000,
    perAttemptLimitCentiseconds: null,
    registrantId: 42,
    attempts: [],
    ...overrides,
  };
}

describe("deriveBudget", () => {
  it("implements the 30:00 WCA example with a timed DNF", () => {
    const summary = deriveBudget(
      budget({
        attempts: [
          tracked("333bf-r1", 1, "ok", 36_000),
          tracked("333bf-r1", 2, "dnf", 60_000),
        ],
      }),
    );

    expect(summary.usedCentiseconds).toBe(96_000);
    expect(summary.capForNextAttemptCentiseconds).toBe(84_000);
    expect(summary.unknownCount).toBe(0);
  });

  it("uses the remaining budget when it is below the per-attempt limit", () => {
    const summary = deriveBudget(
      budget({
        limitCentiseconds: 120_000,
        perAttemptLimitCentiseconds: 48_000,
        attempts: [
          tracked("444-r1", 1, "ok", 42_000),
          tracked("444-r1", 2, "ok", 45_000),
        ],
      }),
    );

    expect(summary.remainingCentiseconds).toBe(33_000);
    expect(summary.capForNextAttemptCentiseconds).toBe(33_000);
  });

  it.each([
    ["exactly zero", 120_000, true],
    ["past zero", 121_000, true],
    ["above zero", 119_999, false],
  ])("marks a budget exhausted at %s", (_label, spent, exhausted) => {
    const summary = deriveBudget(
      budget({
        limitCentiseconds: 120_000,
        attempts: [tracked("444-r1", 1, "ok", spent)],
      }),
    );
    expect(summary.exhausted).toBe(exhausted);
  });

  it.each([0, 1, 3])("tracks %i unknown DNF elapsed times as an upper bound", (count) => {
    const attempts = Array.from({ length: count }, (_, index) =>
      tracked("333bf-r1", index + 1, "dnf", null),
    );
    const summary = deriveBudget(budget({ attempts }));
    expect(summary.unknownCount).toBe(count);
    expect(summary.isUpperBound).toBe(count > 0);
    expect(summary.remainingCentiseconds).toBe(180_000);
  });

  it("uses a truncated ten-minute result in the budget", () => {
    const entered = autocompleteTime(60_047);
    const summary = deriveBudget(
      budget({
        limitCentiseconds: 120_000,
        attempts: [tracked("333bf-r1", 1, "ok", entered)],
      }),
    );
    expect(summary.usedCentiseconds).toBe(60_000);
    expect(summary.remainingCentiseconds).toBe(60_000);
  });
});

describe("attempts left", () => {
  const cutoffPlan: RoundPlan = {
    roundId: "444-r1",
    eventId: "444",
    format: "a",
    registered: true,
    cutoff: { numberOfAttempts: 2, attemptResult: 6_000 },
  };

  it("removes the remaining attempts after a failed cutoff", () => {
    const attempts = [
      tracked("444-r1", 1, "ok", 6_500),
      tracked("444-r1", 2, "dnf", 7_000),
    ];
    expect(attemptsLeftForRound(cutoffPlan, attempts)).toBe(0);
  });

  it("keeps the remaining attempts after a passed cutoff", () => {
    const attempts = [
      tracked("444-r1", 1, "ok", 5_900),
      tracked("444-r1", 2, "dnf", 7_000),
    ];
    expect(attemptsLeftForRound(cutoffPlan, attempts)).toBe(3);
  });

  it("ignores rounds for events the competitor did not register for", () => {
    const otherRound: RoundPlan = {
      ...cutoffPlan,
      roundId: "555-r1",
      eventId: "555",
      cutoff: null,
      registered: false,
    };
    expect(attemptsLeft([cutoffPlan, otherRound], [])).toBe(5);
  });
});

describe("budget actions", () => {
  it("marks only skipped attempts in the selected round as automatic DNS", () => {
    const attempts = [
      tracked("444-r1", 1, "ok", 50_000),
      tracked("444-r1", 2, "skipped", null),
      tracked("555-r1", 1, "skipped", null),
    ];
    const next = dnsRemainingInRound(attempts, "444-r1", "2026-02-01T00:00:00.000Z");
    expect(next[1]).toMatchObject({ outcome: "dns", auto: true });
    expect(next[2]?.outcome).toBe("skipped");
  });

  it("records a stopped attempt as DNF at exactly the remaining limit", () => {
    const current = budget({
      limitCentiseconds: 120_000,
      attempts: [
        tracked("444-r1", 1, "ok", 90_000),
        tracked("444-r1", 2, "skipped", null),
      ],
    });
    const next = stopAttemptAtLimit(current, "444-r1", 2);
    expect(next.attempts[1]).toMatchObject({ outcome: "dnf", centiseconds: 30_000 });
    expect(deriveBudget(next).remainingCentiseconds).toBe(0);
  });

  it("replaces an existing target using the budget available before it", () => {
    const current = budget({
      limitCentiseconds: 120_000,
      attempts: [
        tracked("444-r1", 1, "ok", 90_000),
        tracked("444-r1", 2, "ok", 10_000),
      ],
    });
    const next = stopAttemptAtLimit(current, "444-r1", 2);
    expect(next.attempts[1]).toMatchObject({ outcome: "dnf", centiseconds: 30_000 });
  });

  it("marks the round's untaken attempts DNS after stopping at the limit", () => {
    const current = budget({
      limitCentiseconds: 120_000,
      attempts: [
        tracked("444bf-r1", 1, "ok", 90_000),
        tracked("444bf-r1", 2, "skipped", null),
        tracked("444bf-r1", 3, "skipped", null),
        tracked("555bf-r1", 1, "skipped", null, 4),
      ],
    });
    const next = stopAttemptAtLimit(current, "444bf-r1", 2);
    expect(next.attempts.map(({ outcome }) => outcome)).toEqual(["ok", "dnf", "dns", "skipped"]);
    expect(next.attempts[2]).toMatchObject({ auto: true, centiseconds: null });
  });

  it("refuses stop-at-limit while an elapsed time is unknown", () => {
    const current = budget({
      attempts: [
        tracked("333bf-r1", 1, "dnf", null),
        tracked("333bf-r1", 2, "skipped", null),
      ],
    });
    expect(() => stopAttemptAtLimit(current, "333bf-r1", 2)).toThrow(/unknown/i);
  });
});

describe("cumulative helpers", () => {
  it("creates stable group keys", () => {
    expect(groupKey(["555-r1", "444-r1", "444-r1"])).toBe("444-r1+555-r1");
  });

  it("warns about an invalid per-attempt limit", () => {
    expect(
      perAttemptLimitWarning(
        budget({ limitCentiseconds: 60_000, perAttemptLimitCentiseconds: 60_001 }),
      ),
    ).toMatch(/cannot be greater/i);
  });

  it("computes average guidance only for known positive remaining attempts", () => {
    const summary = deriveBudget(budget({ limitCentiseconds: 120_000 }));
    expect(averageForRemainingAttempts(summary, 3)).toBe(40_000);
    expect(averageForRemainingAttempts(summary, 0)).toBeNull();
  });

  it("derives the cap that applied before a chronological attempt", () => {
    const current = budget({
      limitCentiseconds: 120_000,
      perAttemptLimitCentiseconds: 50_000,
      attempts: [
        tracked("444-r1", 2, "ok", 45_000, 2),
        tracked("444-r1", 1, "ok", 80_000, 1),
      ],
    });
    expect(budgetBeforeAttempt(current, "444-r1", 2)).toMatchObject({
      remainingCentiseconds: 40_000,
      capForNextAttemptCentiseconds: 40_000,
    });
  });

  it("reorders a multi-round group without mutating attempt identity", () => {
    const attempts = [
      tracked("444-r1", 1, "ok", 40_000),
      tracked("555-r1", 1, "ok", 50_000),
    ];
    const reordered = reorderAttempts(attempts, [
      attemptKey("555-r1", 1),
      attemptKey("444-r1", 1),
    ]);
    expect(reordered.map(({ roundId, order }) => [roundId, order])).toEqual([
      ["444-r1", 2],
      ["555-r1", 1],
    ]);
    expect(attempts.map(({ order }) => order)).toEqual([1, 1]);
  });

  it("rejects missing and zero cumulative limits", () => {
    expect(isTrackableBudget(budget({ limitCentiseconds: 0 }))).toBe(false);
    expect(isTrackableBudget(budget({ limitCentiseconds: 1 }))).toBe(true);
  });
});
