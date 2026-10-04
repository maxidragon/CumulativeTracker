import { useQueryClient } from "@tanstack/react-query";
import type { Person } from "@wca/helpers";
import { officialResult, type TrackedAttempt } from "../../lib/attempt";
import {
  attemptsLeft,
  averageForRemainingAttempts,
  dnsRemainingInRound,
  orderedAttempts,
  reorderAttempts,
  stopAttemptAtLimit,
  type Budget,
} from "../../lib/cumulative";
import {
  createCompetitionBudget,
  plansForCompetitor,
  type CompetitionGroup,
} from "../../lib/wca";
import {
  enterLiveAttempt,
  remoteResultForAttempt,
  takeRemoteAttempt,
  withAcknowledgedAttempt,
  type LiveResults,
  type ScoretakingToken,
} from "../../lib/wcaLive";
import { liveResultsKey, useLiveResults, useOnlineStatus } from "../live/hooks";
import { trackingBudgetKey, useTrackingStore } from "./trackingStore";
import { summaryForGroup } from "./viewModel";

export type CompetitorAction = "stop" | "dns" | "clear";

/**
 * Not yet on WCA Live as entered here: a new or changed result (including where WCA Live
 * differs), or an attempt cleared here that WCA Live still has.
 */
function isPending(attempt: TrackedAttempt): boolean {
  if (attempt.outcome === "skipped") return attempt.syncStatus === "local";
  return (
    !attempt.estimated &&
    attempt.syncStatus !== "sending" &&
    (attempt.syncStatus !== "synced" || attempt.remoteResult !== undefined)
  );
}

function sameAttempt(left: TrackedAttempt, right: TrackedAttempt): boolean {
  return left.roundId === right.roundId && left.attemptNumber === right.attemptNumber;
}

/**
 * Entry, WCA Live submission and the regulation-bearing actions for one competitor.
 * The group screen owns loading and reconciling budgets; this only mutates them.
 */
export function useCompetitorEntry(
  competitionId: string,
  group: CompetitionGroup,
  person: Person,
  liveToken: ScoretakingToken | null,
) {
  const updateAttempt = useTrackingStore((state) => state.updateAttempt);
  const replaceBudget = useTrackingStore((state) => state.replaceBudget);
  const setAttemptSync = useTrackingStore((state) => state.setAttemptSync);
  const perAttemptLimit = useTrackingStore(
    (state) => state.competitions[competitionId]?.groupSettings[group.key] ?? null,
  );
  const stored = useTrackingStore(
    (state) =>
      state.competitions[competitionId]?.budgets[
        trackingBudgetKey(group.key, person.registrantId)
      ],
  );
  const online = useOnlineStatus();
  const liveResults = useLiveResults(competitionId, liveToken !== null);
  const queryClient = useQueryClient();

  const emptyBudget = createCompetitionBudget(person, group, perAttemptLimit);
  const budget: Budget = stored ?? emptyBudget;
  const summary = summaryForGroup(group, budget);
  const remainingAttempts = attemptsLeft(plansForCompetitor(person, group), budget.attempts);
  const average = averageForRemainingAttempts(summary, remainingAttempts);
  const ordered = orderedAttempts(budget.attempts);
  const nextAttempt = ordered.find(({ outcome }) => outcome === "skipped") ?? null;
  const canSubmit = liveToken !== null && online;

  const setSync = (
    attempt: TrackedAttempt,
    sync: Pick<TrackedAttempt, "syncStatus" | "syncError" | "remoteResult">,
  ) =>
    setAttemptSync(
      competitionId,
      group.key,
      person.registrantId,
      attempt.roundId,
      attempt.attemptNumber,
      sync,
    );

  const latestAttempt = (target: TrackedAttempt) =>
    useTrackingStore
      .getState()
      .competitions[competitionId]?.budgets[
        trackingBudgetKey(group.key, person.registrantId)
      ]?.attempts.find((attempt) => sameAttempt(attempt, target));

  const submitAttempt = async (attempt: TrackedAttempt, overwriteRemote = false) => {
    if (!liveToken || !online || attempt.estimated || !isPending(attempt)) return;
    const round = group.rounds.find(({ roundId }) => roundId === attempt.roundId);
    if (!round) return;
    const sentResult = officialResult(attempt);

    try {
      const refreshed = await liveResults.refetch();
      if (refreshed.error || !refreshed.data) {
        throw new Error("WCA Live results could not be refreshed before submission.");
      }
      const remote = remoteResultForAttempt(
        refreshed.data,
        group,
        person.registrantId,
        attempt,
      );
      if (!overwriteRemote && remote !== null) {
        setSync(
          attempt,
          remote === sentResult
            ? { syncStatus: "synced", syncError: undefined, remoteResult: undefined }
            : { syncStatus: "local", syncError: undefined, remoteResult: remote },
        );
        return;
      }

      setSync(attempt, {
        syncStatus: "sending",
        syncError: undefined,
        remoteResult: attempt.remoteResult,
      });
      await enterLiveAttempt(liveToken.token, {
        competitionWcaId: competitionId,
        eventId: round.eventId,
        roundNumber: round.roundNumber,
        registrantId: person.registrantId,
        attemptNumber: attempt.attemptNumber,
        attemptResult: sentResult,
      });
      // The results fetched above predate this submission. Patch them before marking the attempt
      // synced, or reconciling against them would read the old value as a remote edit.
      queryClient.setQueryData<LiveResults>(liveResultsKey(competitionId), (cached) =>
        cached
          ? withAcknowledgedAttempt(cached, group, person.registrantId, attempt, sentResult)
          : cached,
      );
      const latest = latestAttempt(attempt);
      if (
        latest &&
        latest.enteredAt === attempt.enteredAt &&
        officialResult(latest) === sentResult
      ) {
        setSync(attempt, {
          // A cleared attempt is simply empty again once WCA Live has dropped it.
          syncStatus: attempt.outcome === "skipped" ? undefined : "synced",
          syncError: undefined,
          remoteResult: undefined,
        });
      }
    } catch (error) {
      const latest = latestAttempt(attempt);
      if (latest?.enteredAt === attempt.enteredAt) {
        setSync(attempt, {
          // A clear that failed stays pending, so the next confirm retries it.
          syncStatus: latest.outcome === "skipped" ? "local" : "failed",
          syncError: error instanceof Error ? error.message : "WCA Live submission failed.",
          remoteResult: latest.remoteResult,
        });
      }
    }
  };

  const commitAttempt = (attempt: TrackedAttempt) => {
    updateAttempt(competitionId, group.key, person.registrantId, attempt);
  };

  const storedAttempts = () =>
    useTrackingStore.getState().competitions[competitionId]?.budgets[
      trackingBudgetKey(group.key, person.registrantId)
    ]?.attempts ?? [];

  /**
   * Sends every entered attempt WCA Live does not have yet, one at a time as it expects;
   * conflicts wait for an explicit choice. Reads the store rather than this render, so an
   * attempt committed by the same Enter press is included. Resolves true when nothing is
   * left needing attention, so the scorecard can be closed.
   */
  const submitPending = async (): Promise<boolean> => {
    if (!canSubmit) return false;
    // Confirming the scorecard is the scoretaker's decision, so it overwrites what WCA Live has.
    for (const attempt of storedAttempts().filter(isPending)) await submitAttempt(attempt, true);
    return storedAttempts().every(
      (attempt) =>
        attempt.syncStatus !== "failed" &&
        attempt.remoteResult === undefined &&
        attempt.syncError === undefined,
    );
  };

  const runAction = (action: CompetitorAction) => {
    if (action === "clear") {
      // Attempts WCA Live has stay marked, so confirming the scorecard clears them there too.
      replaceBudget(competitionId, {
        ...emptyBudget,
        attempts: emptyBudget.attempts.map((empty) => {
          const current = budget.attempts.find((attempt) => sameAttempt(attempt, empty));
          const onLive =
            current?.syncStatus === "synced" ||
            (current?.outcome === "skipped" && current.syncStatus === "local");
          return onLive ? { ...empty, syncStatus: "local" as const } : empty;
        }),
      });
      return;
    }
    if (!nextAttempt) return;
    if (action === "dns") {
      const next = {
        ...budget,
        attempts: dnsRemainingInRound(budget.attempts, nextAttempt.roundId),
      };
      replaceBudget(competitionId, next);
      return;
    }
    if (!group.cumulative) {
      commitAttempt({
        ...nextAttempt,
        outcome: "dnf",
        centiseconds: group.limitCentiseconds,
        estimated: false,
        enteredAt: new Date().toISOString(),
      });
      return;
    }
    replaceBudget(
      competitionId,
      stopAttemptAtLimit(budget, nextAttempt.roundId, nextAttempt.attemptNumber),
    );
  };

  const moveAttempt = (from: number, to: number) => {
    if (from === to || to < 0 || to >= ordered.length) return;
    const keys = ordered.map((item) => `${item.roundId}:${item.attemptNumber}`);
    const [moved] = keys.splice(from, 1);
    if (moved === undefined) return;
    keys.splice(to, 0, moved);
    replaceBudget(competitionId, { ...budget, attempts: reorderAttempts(budget.attempts, keys) });
  };

  const takeRemote = (attempt: TrackedAttempt) => {
    const remoteResult = attempt.remoteResult;
    if (remoteResult === undefined) return;
    replaceBudget(competitionId, {
      ...budget,
      attempts: budget.attempts.map((current) =>
        sameAttempt(current, attempt) ? takeRemoteAttempt(current, remoteResult) : current,
      ),
    });
  };

  return {
    budget,
    summary,
    remainingAttempts,
    average,
    ordered,
    nextAttempt,
    online,
    canSubmit,
    liveResultsFailed: liveToken !== null && liveResults.isError,
    commitAttempt,
    submitAttempt,
    submitPending,
    runAction,
    moveAttempt,
    takeRemote,
  };
}
