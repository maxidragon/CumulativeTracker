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
  type ScoretakingToken,
} from "../../lib/wcaLive";
import { useLiveResults, useOnlineStatus } from "../live/hooks";
import { trackingBudgetKey, useTrackingStore } from "./trackingStore";
import { summaryForGroup } from "./viewModel";

export type CompetitorAction = "stop" | "dns" | "clear";

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
    if (!liveToken || !online || attempt.outcome === "skipped" || attempt.estimated) return;
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
      const latest = latestAttempt(attempt);
      if (
        latest &&
        latest.enteredAt === attempt.enteredAt &&
        officialResult(latest) === sentResult
      ) {
        setSync(attempt, { syncStatus: "synced", syncError: undefined, remoteResult: undefined });
      }
    } catch (error) {
      const latest = latestAttempt(attempt);
      if (latest?.enteredAt === attempt.enteredAt) {
        setSync(attempt, {
          syncStatus: "failed",
          syncError: error instanceof Error ? error.message : "WCA Live submission failed.",
          remoteResult: latest.remoteResult,
        });
      }
    }
  };

  const commitAttempt = (attempt: TrackedAttempt) => {
    updateAttempt(competitionId, group.key, person.registrantId, attempt);
    if (canSubmit && attempt.outcome !== "skipped" && !attempt.estimated) {
      void submitAttempt({ ...attempt, syncStatus: "local" });
    }
  };

  const runAction = (action: CompetitorAction) => {
    if (action === "clear") {
      replaceBudget(competitionId, emptyBudget);
      return;
    }
    if (!nextAttempt) return;
    if (action === "dns") {
      const next = {
        ...budget,
        attempts: dnsRemainingInRound(budget.attempts, nextAttempt.roundId),
      };
      replaceBudget(competitionId, next);
      if (!canSubmit) return;
      for (const attempt of next.attempts) {
        if (
          attempt.roundId === nextAttempt.roundId &&
          attempt.outcome === "dns" &&
          attempt.syncStatus === "local"
        ) {
          void submitAttempt(attempt);
        }
      }
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
    const next = stopAttemptAtLimit(budget, nextAttempt.roundId, nextAttempt.attemptNumber);
    replaceBudget(competitionId, next);
    const stopped = next.attempts.find((attempt) => sameAttempt(attempt, nextAttempt));
    if (stopped && canSubmit) void submitAttempt(stopped);
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
    liveResultsFailed: liveToken !== null && liveResults.isError,
    commitAttempt,
    submitAttempt,
    runAction,
    moveAttempt,
    takeRemote,
  };
}
