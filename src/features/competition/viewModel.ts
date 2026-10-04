import { countedTime, formatTime, type TrackedAttempt } from "../../lib/attempt";
import { deriveBudget, type Budget, type BudgetSummary } from "../../lib/cumulative";
import type { CompetitionGroup } from "../../lib/wca";

export function summaryForGroup(
  group: CompetitionGroup,
  budget: Budget,
): BudgetSummary {
  if (group.cumulative) return deriveBudget(budget);

  let usedCentiseconds = 0;
  let unknownCount = 0;
  for (const attempt of budget.attempts) {
    const counted = countedTime(attempt);
    if (counted === null) unknownCount += 1;
    else usedCentiseconds += counted;
  }
  return {
    usedCentiseconds,
    unknownCount,
    remainingCentiseconds: group.limitCentiseconds,
    capForNextAttemptCentiseconds: group.limitCentiseconds,
    exhausted: false,
    isUpperBound: unknownCount > 0,
  };
}

/** A results-table cell: what WCA Live would show, plus the elapsed time behind a DNF. */
export function formatAttemptResult(attempt: TrackedAttempt): string {
  if (attempt.outcome === "skipped") return "";
  if (attempt.outcome === "dns") return "DNS";
  if (attempt.outcome === "dnf") {
    return attempt.centiseconds === null
      ? "DNF (?)"
      : `DNF (${formatTime(attempt.centiseconds)})`;
  }
  return formatTime(attempt.centiseconds ?? 0);
}

export function countryFlag(countryIso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryIso2)) return "";
  return [...countryIso2.toUpperCase()]
    .map((letter) => String.fromCodePoint(127_397 + letter.charCodeAt(0)))
    .join("");
}

export type SyncLabel = "Local" | "Sending" | "On WCA Live" | "Failed";

export function attemptSyncLabel(attempt: TrackedAttempt): SyncLabel {
  if (attempt.syncStatus === "synced") return "On WCA Live";
  if (attempt.syncStatus === "sending") return "Sending";
  if (attempt.syncStatus === "failed") return "Failed";
  return "Local";
}

export function budgetSyncLabel(budget: Budget): SyncLabel | null {
  const entered = budget.attempts.filter(({ outcome }) => outcome !== "skipped");
  if (entered.length === 0) return null;
  if (entered.some(({ syncStatus }) => syncStatus === "failed")) return "Failed";
  if (entered.some(({ syncStatus }) => syncStatus === "sending")) return "Sending";
  if (
    entered.some(
      ({ remoteResult, syncStatus }) =>
        remoteResult !== undefined || syncStatus === "local" || syncStatus === undefined,
    )
  ) {
    return "Local";
  }
  return "On WCA Live";
}

/** Entered attempts that WCA Live does not have yet: what a scoretaker still owes. */
export function unsyncedAttemptCount(budget: Budget): number {
  return budget.attempts.filter(
    (attempt) =>
      attempt.outcome !== "skipped" &&
      !attempt.estimated &&
      (attempt.syncStatus !== "synced" || attempt.remoteResult !== undefined),
  ).length;
}
