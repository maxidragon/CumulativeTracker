import { create } from "zustand";
import { isTrackedAttempt, type TrackedAttempt } from "../../lib/attempt";
import type { Budget } from "../../lib/cumulative";
import { readJson, storageKeys, writeJson } from "../../lib/storage";

export type CompetitionTracking = {
  version: 1;
  budgets: Record<string, Budget>;
  groupSettings: Record<string, number | null>;
  liveEnabled: boolean;
};

type TrackingStore = {
  competitions: Record<string, CompetitionTracking>;
  resetTracking: () => void;
  loadCompetition: (competitionId: string) => void;
  ensureBudgets: (competitionId: string, budgets: Budget[]) => void;
  updateAttempt: (
    competitionId: string,
    groupKey: string,
    registrantId: number,
    attempt: TrackedAttempt,
  ) => void;
  replaceBudget: (competitionId: string, budget: Budget) => void;
  setAttemptSync: (
    competitionId: string,
    groupKey: string,
    registrantId: number,
    roundId: string,
    attemptNumber: number,
    sync: Pick<TrackedAttempt, "syncStatus" | "syncError" | "remoteResult">,
  ) => void;
  setLiveEnabled: (competitionId: string, enabled: boolean) => void;
  setGroupPerAttemptLimit: (
    competitionId: string,
    groupKey: string,
    centiseconds: number | null,
  ) => void;
};

export function trackingBudgetKey(groupKey: string, registrantId: number): string {
  return `${groupKey}:${registrantId}`;
}

function emptyTracking(): CompetitionTracking {
  return { version: 1, budgets: {}, groupSettings: {}, liveEnabled: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBudget(value: unknown): value is Budget {
  if (
    !isRecord(value) ||
    typeof value.groupKey !== "string" ||
    !Number.isSafeInteger(value.limitCentiseconds) ||
    (value.limitCentiseconds as number) <= 0 ||
    (value.perAttemptLimitCentiseconds !== null &&
      (!Number.isSafeInteger(value.perAttemptLimitCentiseconds) ||
        (value.perAttemptLimitCentiseconds as number) <= 0)) ||
    !Number.isInteger(value.registrantId) ||
    !Array.isArray(value.attempts)
  ) {
    return false;
  }
  if (!value.attempts.every(isTrackedAttempt)) return false;
  const attemptKeys = value.attempts.map(
    (attempt) => `${attempt.roundId}:${attempt.attemptNumber}`,
  );
  const orders = value.attempts.map(({ order }) => order);
  return (
    new Set(attemptKeys).size === attemptKeys.length &&
    new Set(orders).size === orders.length
  );
}

export function isCompetitionTracking(value: unknown): value is CompetitionTracking {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.budgets) ||
    !isRecord(value.groupSettings) ||
    typeof value.liveEnabled !== "boolean"
  ) {
    return false;
  }
  return (
    Object.values(value.budgets).every(isBudget) &&
    Object.values(value.groupSettings).every(
      (setting) =>
        setting === null || (Number.isSafeInteger(setting) && (setting as number) > 0),
    )
  );
}

type LegacyCompetitionTracking = Omit<CompetitionTracking, "liveEnabled">;

function isLegacyCompetitionTracking(value: unknown): value is LegacyCompetitionTracking {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.budgets) ||
    !isRecord(value.groupSettings) ||
    "liveEnabled" in value
  ) {
    return false;
  }
  return (
    Object.values(value.budgets).every(isBudget) &&
    Object.values(value.groupSettings).every(
      (setting) =>
        setting === null || (Number.isSafeInteger(setting) && (setting as number) > 0),
    )
  );
}

function isStoredCompetitionTracking(
  value: unknown,
): value is CompetitionTracking | LegacyCompetitionTracking {
  return isCompetitionTracking(value) || isLegacyCompetitionTracking(value);
}

function readCompetitionTracking(competitionId: string): CompetitionTracking {
  const stored = readJson(
    storageKeys.budgets(competitionId),
    isStoredCompetitionTracking,
  );
  if (!stored) return emptyTracking();
  if ("liveEnabled" in stored) return stored;
  return persist(competitionId, { ...stored, liveEnabled: false });
}

function persist(competitionId: string, tracking: CompetitionTracking): CompetitionTracking {
  writeJson(storageKeys.budgets(competitionId), tracking);
  return tracking;
}

export const useTrackingStore = create<TrackingStore>((set) => ({
  competitions: {},
  resetTracking: () => set({ competitions: {} }),
  loadCompetition: (competitionId) =>
    set(({ competitions }) => {
      if (competitions[competitionId]) return { competitions };
      const tracking = readCompetitionTracking(competitionId);
      return { competitions: { ...competitions, [competitionId]: tracking } };
    }),
  ensureBudgets: (competitionId, budgets) =>
    set(({ competitions }) => {
      const current = competitions[competitionId] ?? emptyTracking();
      let changed = false;
      const nextBudgets = { ...current.budgets };
      for (const budget of budgets) {
        const key = trackingBudgetKey(budget.groupKey, budget.registrantId);
        if (!nextBudgets[key]) {
          nextBudgets[key] = {
            ...budget,
            perAttemptLimitCentiseconds:
              current.groupSettings[budget.groupKey] ??
              budget.perAttemptLimitCentiseconds,
          };
          changed = true;
        }
      }
      if (!changed && competitions[competitionId]) return { competitions };
      const tracking = persist(competitionId, { ...current, budgets: nextBudgets });
      return { competitions: { ...competitions, [competitionId]: tracking } };
    }),
  updateAttempt: (competitionId, groupKey, registrantId, attempt) =>
    set(({ competitions }) => {
      const current = competitions[competitionId];
      if (!current) return { competitions };
      const key = trackingBudgetKey(groupKey, registrantId);
      const budget = current.budgets[key];
      if (!budget) return { competitions };
      const nextBudget = {
        ...budget,
        attempts: budget.attempts.map((existing) =>
          existing.roundId === attempt.roundId &&
          existing.attemptNumber === attempt.attemptNumber
            ? {
                ...attempt,
                syncStatus:
                  attempt.outcome === "skipped" ? undefined : ("local" as const),
                syncError: undefined,
                changedRemotely: false,
              }
            : existing,
        ),
      };
      const tracking = persist(competitionId, {
        ...current,
        budgets: { ...current.budgets, [key]: nextBudget },
      });
      return { competitions: { ...competitions, [competitionId]: tracking } };
    }),
  replaceBudget: (competitionId, budget) =>
    set(({ competitions }) => {
      const current = competitions[competitionId] ?? emptyTracking();
      const key = trackingBudgetKey(budget.groupKey, budget.registrantId);
      const tracking = persist(competitionId, {
        ...current,
        budgets: { ...current.budgets, [key]: budget },
      });
      return { competitions: { ...competitions, [competitionId]: tracking } };
    }),
  setAttemptSync: (
    competitionId,
    groupKey,
    registrantId,
    roundId,
    attemptNumber,
    sync,
  ) =>
    set(({ competitions }) => {
      const current = competitions[competitionId];
      if (!current) return { competitions };
      const key = trackingBudgetKey(groupKey, registrantId);
      const budget = current.budgets[key];
      if (!budget) return { competitions };
      const nextBudget = {
        ...budget,
        attempts: budget.attempts.map((attempt) =>
          attempt.roundId === roundId && attempt.attemptNumber === attemptNumber
            ? { ...attempt, ...sync }
            : attempt,
        ),
      };
      const tracking = persist(competitionId, {
        ...current,
        budgets: { ...current.budgets, [key]: nextBudget },
      });
      return { competitions: { ...competitions, [competitionId]: tracking } };
    }),
  setLiveEnabled: (competitionId, liveEnabled) =>
    set(({ competitions }) => {
      const current = competitions[competitionId] ?? emptyTracking();
      const tracking = persist(competitionId, { ...current, liveEnabled });
      return { competitions: { ...competitions, [competitionId]: tracking } };
    }),
  setGroupPerAttemptLimit: (competitionId, groupKey, centiseconds) =>
    set(({ competitions }) => {
      const current = competitions[competitionId] ?? emptyTracking();
      const budgets = Object.fromEntries(
        Object.entries(current.budgets).map(([key, budget]) => [
          key,
          budget.groupKey === groupKey
            ? { ...budget, perAttemptLimitCentiseconds: centiseconds }
            : budget,
        ]),
      );
      const tracking = persist(competitionId, {
        ...current,
        budgets,
        groupSettings: { ...current.groupSettings, [groupKey]: centiseconds },
      });
      return { competitions: { ...competitions, [competitionId]: tracking } };
    }),
}));
