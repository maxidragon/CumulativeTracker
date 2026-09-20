import { countedTime, formatTime, type TrackedAttempt } from "../../lib/attempt";
import {
  attemptsLeft,
  averageForRemainingAttempts,
  deriveBudget,
  type Budget,
  type BudgetSummary,
  type RoundPlan,
} from "../../lib/cumulative";
import type { CompetitionGroup } from "../../lib/wca";

export type CompetitorStatus =
  | "Not started"
  | "On track"
  | "Tight"
  | "Exhausted"
  | "Incomplete";

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

export function competitorStatus(
  group: CompetitionGroup,
  budget: Budget,
  plans: RoundPlan[],
): CompetitorStatus {
  const summary = summaryForGroup(group, budget);
  if (summary.unknownCount > 0) return "Incomplete";
  if (group.cumulative && summary.exhausted) return "Exhausted";
  if (budget.attempts.every(({ outcome }) => outcome === "skipped")) return "Not started";

  const left = attemptsLeft(plans, budget.attempts);
  const average = averageForRemainingAttempts(summary, left);
  if (
    group.cumulative &&
    average !== null &&
    budget.perAttemptLimitCentiseconds !== null &&
    average < budget.perAttemptLimitCentiseconds
  ) {
    return "Tight";
  }
  return "On track";
}

export function formatAttemptChip(attempt: TrackedAttempt): string {
  if (attempt.outcome === "skipped") return `#${attempt.attemptNumber} —`;
  if (attempt.outcome === "dns") return `#${attempt.attemptNumber} DNS`;
  if (attempt.outcome === "dnf") {
    return attempt.centiseconds === null
      ? `#${attempt.attemptNumber} DNF (?)`
      : `#${attempt.attemptNumber} DNF (${formatTime(attempt.centiseconds, { compact: true })})`;
  }
  return `#${attempt.attemptNumber} ${formatTime(attempt.centiseconds ?? 0, { compact: true })}`;
}

export function countryFlag(countryIso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryIso2)) return "";
  return [...countryIso2.toUpperCase()]
    .map((letter) => String.fromCodePoint(127_397 + letter.charCodeAt(0)))
    .join("");
}

export function budgetSyncLabel(budget: Budget): string {
  const entered = budget.attempts.filter(({ outcome }) => outcome !== "skipped");
  if (entered.length === 0) return "—";
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
