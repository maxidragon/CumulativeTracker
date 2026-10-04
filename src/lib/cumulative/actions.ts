import type { TrackedAttempt } from "../attempt";
import { budgetBeforeAttempt } from "./budget";
import type { Budget } from "./model";

export function dnsRemainingInRound(
  attempts: TrackedAttempt[],
  roundId: string,
  enteredAt = new Date().toISOString(),
): TrackedAttempt[] {
  return attempts.map((attempt) =>
    attempt.roundId === roundId && attempt.outcome === "skipped"
      ? {
          ...attempt,
          outcome: "dns",
          centiseconds: null,
          estimated: false,
          enteredAt,
          auto: true,
          syncStatus: "local" as const,
          syncError: undefined,
          remoteResult: undefined,
        }
      : attempt,
  );
}

/**
 * The judge stopped this attempt at the cap (A1a4): it is a DNF at exactly the remaining time,
 * and with the limit spent, the round's untaken attempts become DNS.
 */
export function stopAttemptAtLimit(
  budget: Budget,
  roundId: string,
  attemptNumber: number,
  enteredAt = new Date().toISOString(),
): Budget {
  if (
    !budget.attempts.some(
      (attempt) => attempt.roundId === roundId && attempt.attemptNumber === attemptNumber,
    )
  ) {
    throw new Error("The attempt to stop was not found in this budget.");
  }

  const summary = budgetBeforeAttempt(budget, roundId, attemptNumber);
  if (summary.isUpperBound) {
    throw new Error("Cannot stop at the limit while a DNF elapsed time is unknown.");
  }
  if (summary.remainingCentiseconds <= 0) {
    throw new Error("The cumulative limit is already exhausted.");
  }

  const attempts = budget.attempts.map((attempt) => {
    if (attempt.roundId !== roundId || attempt.attemptNumber !== attemptNumber) {
      return attempt;
    }
    return {
      ...attempt,
      outcome: "dnf" as const,
      centiseconds: summary.remainingCentiseconds,
      estimated: false,
      enteredAt,
      auto: false,
      syncStatus: "local" as const,
      syncError: undefined,
      remoteResult: undefined,
    };
  });

  return { ...budget, attempts: dnsRemainingInRound(attempts, roundId, enteredAt) };
}
