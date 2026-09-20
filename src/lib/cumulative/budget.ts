import {
  countedTime,
  isEnteredAttempt,
  type TrackedAttempt,
} from "../attempt";
import type { Budget, BudgetSummary, RoundFormat, RoundPlan } from "./model";

const ATTEMPTS_BY_FORMAT: Record<RoundFormat, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "5": 5,
  a: 5,
  m: 3,
};

export function deriveBudget(budget: Budget): BudgetSummary {
  let usedCentiseconds = 0;
  let unknownCount = 0;

  for (const attempt of budget.attempts) {
    const time = countedTime(attempt);
    if (time === null) unknownCount += 1;
    else usedCentiseconds += time;
  }

  const remainingCentiseconds = budget.limitCentiseconds - usedCentiseconds;
  const capForNextAttemptCentiseconds = Math.min(
    budget.perAttemptLimitCentiseconds ?? Number.POSITIVE_INFINITY,
    remainingCentiseconds,
  );

  return {
    usedCentiseconds,
    unknownCount,
    remainingCentiseconds,
    capForNextAttemptCentiseconds,
    exhausted: remainingCentiseconds <= 0,
    isUpperBound: unknownCount > 0,
  };
}

export function orderedAttempts(attempts: TrackedAttempt[]): TrackedAttempt[] {
  return [...attempts].sort(
    (left, right) =>
      left.order - right.order ||
      left.enteredAt.localeCompare(right.enteredAt) ||
      left.roundId.localeCompare(right.roundId) ||
      left.attemptNumber - right.attemptNumber,
  );
}

export function budgetBeforeAttempt(
  budget: Budget,
  roundId: string,
  attemptNumber: number,
): BudgetSummary {
  const ordered = orderedAttempts(budget.attempts);
  const targetIndex = ordered.findIndex(
    (attempt) =>
      attempt.roundId === roundId && attempt.attemptNumber === attemptNumber,
  );
  if (targetIndex < 0) throw new Error("The attempt was not found in this budget.");

  return deriveBudget({ ...budget, attempts: ordered.slice(0, targetIndex) });
}

export function reorderAttempts(
  attempts: TrackedAttempt[],
  orderedAttemptKeys: string[],
): TrackedAttempt[] {
  if (orderedAttemptKeys.length !== attempts.length) {
    throw new Error("Every attempt must appear exactly once in the new order.");
  }

  const attemptsByKey = new Map(
    attempts.map((attempt) => [attemptKey(attempt.roundId, attempt.attemptNumber), attempt]),
  );
  if (
    attemptsByKey.size !== attempts.length ||
    new Set(orderedAttemptKeys).size !== orderedAttemptKeys.length ||
    orderedAttemptKeys.some((key) => !attemptsByKey.has(key))
  ) {
    throw new Error("Every attempt must appear exactly once in the new order.");
  }

  const orderByKey = new Map(orderedAttemptKeys.map((key, index) => [key, index + 1]));
  return attempts.map((attempt) => {
    const order = orderByKey.get(attemptKey(attempt.roundId, attempt.attemptNumber));
    if (order === undefined) {
      throw new Error("Every attempt must appear exactly once in the new order.");
    }
    return { ...attempt, order };
  });
}

export function attemptKey(roundId: string, attemptNumber: number): string {
  return `${roundId}:${attemptNumber}`;
}

export function attemptsForFormat(format: RoundFormat): number {
  return ATTEMPTS_BY_FORMAT[format];
}

function cutoffPassed(attempts: TrackedAttempt[], threshold: number): boolean {
  return attempts.some(
    (attempt) =>
      attempt.outcome === "ok" &&
      !attempt.estimated &&
      attempt.centiseconds !== null &&
      attempt.centiseconds <= threshold,
  );
}

export function attemptsLeftForRound(
  plan: RoundPlan,
  attempts: TrackedAttempt[],
): number {
  if (!plan.registered) return 0;

  const total = attemptsForFormat(plan.format);
  const roundAttempts = attempts.filter((attempt) => attempt.roundId === plan.roundId);
  const enteredCount = roundAttempts.filter(isEnteredAttempt).length;
  const normalRemaining = Math.max(0, total - enteredCount);

  const cutoff = plan.cutoff;
  if (!cutoff) return normalRemaining;

  const cutoffAttempts = roundAttempts.filter(
    (attempt) =>
      attempt.attemptNumber <= cutoff.numberOfAttempts && isEnteredAttempt(attempt),
  );
  const cutoffComplete = cutoffAttempts.length >= cutoff.numberOfAttempts;

  if (
    cutoffComplete &&
    !cutoffPassed(cutoffAttempts, cutoff.attemptResult)
  ) {
    return 0;
  }

  return normalRemaining;
}

export function attemptsLeft(plans: RoundPlan[], attempts: TrackedAttempt[]): number {
  return plans.reduce(
    (total, plan) => total + attemptsLeftForRound(plan, attempts),
    0,
  );
}

export function averageForRemainingAttempts(
  summary: BudgetSummary,
  remainingAttempts: number,
): number | null {
  if (remainingAttempts <= 0 || summary.isUpperBound) return null;
  return Math.max(0, Math.floor(summary.remainingCentiseconds / remainingAttempts));
}

export function groupKey(roundIds: string[]): string {
  return [...new Set(roundIds)].sort().join("+");
}

export function perAttemptLimitWarning(budget: Budget): string | null {
  if (
    budget.perAttemptLimitCentiseconds !== null &&
    budget.perAttemptLimitCentiseconds > budget.limitCentiseconds
  ) {
    return "The per-attempt limit cannot be greater than the cumulative limit.";
  }
  return null;
}

export function isTrackableBudget(budget: Budget): boolean {
  return Number.isSafeInteger(budget.limitCentiseconds) && budget.limitCentiseconds > 0;
}
