import type { TrackedAttempt } from "../attempt";
import { attemptKey, budgetBeforeAttempt, orderedAttempts, reorderAttempts } from "./budget";
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

function untakenAsDns(attempt: TrackedAttempt, enteredAt: string): TrackedAttempt {
  return attempt.outcome === "skipped"
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
    : attempt;
}

/**
 * The judge stopped this attempt at the cap (A1a4). Whatever order was set before, it is now the
 * last attempt done, so it moves after every entered attempt; it becomes a DNF at exactly what
 * those left, and with the shared limit spent, every untaken attempt in the group is DNS.
 */
export function stopAttemptAtLimit(
  budget: Budget,
  roundId: string,
  attemptNumber: number,
  enteredAt = new Date().toISOString(),
): Budget {
  const ordered = orderedAttempts(budget.attempts);
  const target = ordered.find(
    (attempt) => attempt.roundId === roundId && attempt.attemptNumber === attemptNumber,
  );
  if (!target) throw new Error("The attempt to stop was not found in this budget.");

  const others = ordered.filter((attempt) => attempt !== target);
  let insertAt = 0;
  others.forEach((attempt, index) => {
    if (attempt.outcome !== "skipped") insertAt = index + 1;
  });
  others.splice(insertAt, 0, target);
  const reordered = {
    ...budget,
    attempts: reorderAttempts(
      budget.attempts,
      others.map((attempt) => attemptKey(attempt.roundId, attempt.attemptNumber)),
    ),
  };

  const summary = budgetBeforeAttempt(reordered, roundId, attemptNumber);
  if (summary.isUpperBound) {
    throw new Error("Cannot stop at the limit while a DNF elapsed time is unknown.");
  }
  if (summary.remainingCentiseconds <= 0) {
    throw new Error("The cumulative limit is already exhausted.");
  }

  const attempts = reordered.attempts.map((attempt) =>
    attempt.roundId === roundId && attempt.attemptNumber === attemptNumber
      ? {
          ...attempt,
          outcome: "dnf" as const,
          centiseconds: summary.remainingCentiseconds,
          estimated: false,
          enteredAt,
          auto: false,
          syncStatus: "local" as const,
          syncError: undefined,
          remoteResult: undefined,
        }
      : untakenAsDns(attempt, enteredAt),
  );

  return { ...budget, attempts };
}
