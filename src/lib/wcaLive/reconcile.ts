import {
  DNF_VALUE,
  DNS_VALUE,
  officialResult,
  type TrackedAttempt,
} from "../attempt";
import type { Budget } from "../cumulative";
import type { CompetitionGroup } from "../wca";
import type { LiveResults } from "./client";

export function remoteResultForAttempt(
  results: LiveResults,
  group: CompetitionGroup,
  registrantId: number,
  attempt: TrackedAttempt,
): number | null {
  const round = group.rounds.find(({ roundId }) => roundId === attempt.roundId);
  if (!round) return null;
  const liveEvent = results.events.find(({ eventId }) => eventId === round.eventId);
  const liveRound = liveEvent?.rounds.find(({ number }) => number === round.roundNumber);
  const liveResult = liveRound?.results.find(({ personId }) => personId === registrantId);
  const value = liveResult?.attempts[attempt.attemptNumber - 1];
  return value === undefined || value === 0 ? null : value;
}

function attemptFromRemote(attempt: TrackedAttempt, result: number): TrackedAttempt {
  if (result === DNF_VALUE) {
    return {
      ...attempt,
      outcome: "dnf",
      centiseconds: attempt.outcome === "dnf" ? attempt.centiseconds : null,
      estimated: false,
      syncStatus: "synced",
      syncError: undefined,
      remoteResult: undefined,
    };
  }
  if (result === DNS_VALUE) {
    return {
      ...attempt,
      outcome: "dns",
      centiseconds: null,
      estimated: false,
      syncStatus: "synced",
      syncError: undefined,
      remoteResult: undefined,
    };
  }
  return {
    ...attempt,
    outcome: "ok",
    centiseconds: result,
    estimated: false,
    syncStatus: "synced",
    syncError: undefined,
    remoteResult: undefined,
  };
}

export function takeRemoteAttempt(
  attempt: TrackedAttempt,
  remoteResult: number,
): TrackedAttempt {
  return { ...attemptFromRemote(attempt, remoteResult), changedRemotely: true };
}

export function reconcileLiveBudget(
  budget: Budget,
  group: CompetitionGroup,
  results: LiveResults,
): Budget {
  return {
    ...budget,
    attempts: budget.attempts.map((attempt) => {
      const remote = remoteResultForAttempt(
        results,
        group,
        budget.registrantId,
        attempt,
      );
      if (remote === null) return attempt;
      if (attempt.outcome === "skipped") return attemptFromRemote(attempt, remote);

      const localResult = officialResult(attempt);
      if (localResult === remote) {
        return {
          ...attempt,
          syncStatus: "synced",
          syncError: undefined,
          remoteResult: undefined,
        };
      }
      if (attempt.syncStatus === "synced") {
        return takeRemoteAttempt(attempt, remote);
      }
      return { ...attempt, remoteResult: remote };
    }),
  };
}
