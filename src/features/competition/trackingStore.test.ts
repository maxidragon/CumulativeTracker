import { beforeEach, describe, expect, it } from "vitest";
import type { Budget } from "../../lib/cumulative";
import { storageKeys } from "../../lib/storage";
import {
  isCompetitionTracking,
  trackingBudgetKey,
  useTrackingStore,
} from "./trackingStore";

const budget: Budget = {
  groupKey: "333bf-r1",
  limitCentiseconds: 120_000,
  perAttemptLimitCentiseconds: null,
  registrantId: 7,
  attempts: [
    {
      roundId: "333bf-r1",
      attemptNumber: 1,
      outcome: "skipped",
      centiseconds: null,
      estimated: false,
      order: 1,
      enteredAt: "",
    },
  ],
};

describe("competition tracking store", () => {
  beforeEach(() => {
    localStorage.clear();
    useTrackingStore.setState({ competitions: {} });
  });

  it("initializes and persists a competitor budget", () => {
    useTrackingStore.getState().ensureBudgets("InventedOpen2026", [budget]);
    const stored = JSON.parse(
      localStorage.getItem(storageKeys.budgets("InventedOpen2026")) ?? "null",
    ) as unknown;
    expect(isCompetitionTracking(stored)).toBe(true);
    expect(
      useTrackingStore.getState().competitions.InventedOpen2026?.budgets[
        trackingBudgetKey("333bf-r1", 7)
      ],
    ).toEqual(budget);
  });

  it("updates one attempt without replacing other budget data", () => {
    useTrackingStore.getState().ensureBudgets("InventedOpen2026", [budget]);
    useTrackingStore.getState().updateAttempt("InventedOpen2026", "333bf-r1", 7, {
      ...budget.attempts[0]!,
      outcome: "dnf",
      centiseconds: 60_000,
    });
    const updated =
      useTrackingStore.getState().competitions.InventedOpen2026?.budgets[
        trackingBudgetKey("333bf-r1", 7)
      ];
    expect(updated?.attempts[0]).toMatchObject({ outcome: "dnf", centiseconds: 60_000 });
    expect(updated?.limitCentiseconds).toBe(120_000);
  });

  it("applies a per-attempt setting to every budget in a group", () => {
    const second = { ...budget, registrantId: 8 };
    useTrackingStore.getState().ensureBudgets("InventedOpen2026", [budget, second]);
    useTrackingStore
      .getState()
      .setGroupPerAttemptLimit("InventedOpen2026", "333bf-r1", 60_000);
    const budgets = Object.values(
      useTrackingStore.getState().competitions.InventedOpen2026?.budgets ?? {},
    );
    expect(budgets.map(({ perAttemptLimitCentiseconds }) => perAttemptLimitCentiseconds)).toEqual([
      60_000,
      60_000,
    ]);
  });

  it("rejects corrupt persisted attempt shapes", () => {
    expect(
      isCompetitionTracking({
        version: 1,
        budgets: { broken: { ...budget, attempts: [{ outcome: "ok" }] } },
        groupSettings: {},
      }),
    ).toBe(false);
  });
});
