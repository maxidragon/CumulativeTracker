import {
  ArrowDownward,
  ArrowUpward,
  CloudDoneOutlined,
  CloudOffOutlined,
  HourglassTop,
  SaveOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmActionDialog } from "../../components/ConfirmActionDialog";
import { formatTime, officialResult, type TrackedAttempt } from "../../lib/attempt";
import {
  attemptsLeft,
  averageForRemainingAttempts,
  budgetBeforeAttempt,
  dnsRemainingInRound,
  orderedAttempts,
  reorderAttempts,
  stopAttemptAtLimit,
} from "../../lib/cumulative";
import {
  competitorsForGroup,
  createCompetitionBudget,
  extractCompetitionGroups,
  plansForCompetitor,
} from "../../lib/wca";
import { AttemptInput } from "../entry/AttemptInput";
import { CompetitionState } from "./CompetitionState";
import { useCompetitionData } from "./data";
import { trackingBudgetKey, useTrackingStore } from "./trackingStore";
import { countryFlag, summaryForGroup } from "./viewModel";
import { useAuthStore } from "../auth/store";
import { activeLiveToken } from "../live/mode";
import { useLiveResults, useOnlineStatus } from "../live/hooks";
import {
  enterLiveAttempt,
  reconcileLiveBudget,
  remoteResultForAttempt,
  takeRemoteAttempt,
} from "../../lib/wcaLive";

type PendingAction = "stop" | "dns" | "clear" | null;

export function CompetitorScreen() {
  const {
    competitionId = "",
    groupKey = "",
    registrantId: registrantIdParam = "",
  } = useParams();
  const registrantId = Number(registrantIdParam);
  const query = useCompetitionData(competitionId);
  const loadCompetition = useTrackingStore((state) => state.loadCompetition);
  const ensureBudgets = useTrackingStore((state) => state.ensureBudgets);
  const updateAttempt = useTrackingStore((state) => state.updateAttempt);
  const replaceBudget = useTrackingStore((state) => state.replaceBudget);
  const setAttemptSync = useTrackingStore((state) => state.setAttemptSync);
  const tracking = useTrackingStore((state) => state.competitions[competitionId]);
  const session = useAuthStore((state) => state.session);
  const liveToken = activeLiveToken(competitionId, tracking, session);
  const online = useOnlineStatus();
  const liveResults = useLiveResults(competitionId, liveToken !== null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const group = query.data
    ? extractCompetitionGroups(query.data.wcif).find(({ key }) => key === groupKey)
    : undefined;
  const person =
    query.data && group
      ? competitorsForGroup(query.data.wcif, group).find(
          (candidate) => candidate.registrantId === registrantId,
        )
      : undefined;
  const fallbackBudget = useMemo(
    () =>
      group && person
        ? createCompetitionBudget(
            person,
            group,
            tracking?.groupSettings[group.key] ?? null,
          )
        : null,
    [group, person, tracking?.groupSettings],
  );

  useEffect(() => loadCompetition(competitionId), [competitionId, loadCompetition]);
  useEffect(() => {
    if (fallbackBudget) ensureBudgets(competitionId, [fallbackBudget]);
  }, [competitionId, ensureBudgets, fallbackBudget]);

  const budget =
    group && person
      ? tracking?.budgets[trackingBudgetKey(group.key, person.registrantId)] ??
        fallbackBudget
      : null;
  const summary = group && budget ? summaryForGroup(group, budget) : null;
  const plans = group && person ? plansForCompetitor(person, group) : [];
  const remainingAttempts = budget ? attemptsLeft(plans, budget.attempts) : 0;
  const average = summary
    ? averageForRemainingAttempts(summary, remainingAttempts)
    : null;
  const ordered = budget ? orderedAttempts(budget.attempts) : [];
  const nextAttempt = ordered.find(({ outcome }) => outcome === "skipped");

  useEffect(() => {
    if (!budget || !group || !liveResults.data) return;
    const reconciled = reconcileLiveBudget(budget, group, liveResults.data);
    if (JSON.stringify(reconciled) !== JSON.stringify(budget)) {
      replaceBudget(competitionId, reconciled);
    }
  }, [budget, competitionId, group, liveResults.data, replaceBudget]);

  const currentAttempt = (target: TrackedAttempt) => {
    if (!group) return undefined;
    const currentTracking = useTrackingStore.getState().competitions[competitionId];
    const currentBudget =
      currentTracking?.budgets[trackingBudgetKey(group.key, registrantId)];
    return currentBudget?.attempts.find(
      (attempt) =>
        attempt.roundId === target.roundId &&
        attempt.attemptNumber === target.attemptNumber,
    );
  };

  const submitAttempt = async (attempt: TrackedAttempt, submitMine = false) => {
    if (
      !liveToken ||
      !group ||
      !person ||
      !online ||
      attempt.outcome === "skipped" ||
      attempt.estimated
    ) {
      return;
    }
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
      if (!submitMine && remote !== null) {
        if (remote === sentResult) {
          setAttemptSync(
            competitionId,
            group.key,
            person.registrantId,
            attempt.roundId,
            attempt.attemptNumber,
            { syncStatus: "synced", syncError: undefined, remoteResult: undefined },
          );
        } else {
          setAttemptSync(
            competitionId,
            group.key,
            person.registrantId,
            attempt.roundId,
            attempt.attemptNumber,
            { syncStatus: "local", syncError: undefined, remoteResult: remote },
          );
        }
        return;
      }

      setAttemptSync(
        competitionId,
        group.key,
        person.registrantId,
        attempt.roundId,
        attempt.attemptNumber,
        { syncStatus: "sending", syncError: undefined, remoteResult: attempt.remoteResult },
      );
      await enterLiveAttempt(liveToken.token, {
        competitionWcaId: competitionId,
        eventId: round.eventId,
        roundNumber: round.roundNumber,
        registrantId: person.registrantId,
        attemptNumber: attempt.attemptNumber,
        attemptResult: sentResult,
      });
      const latest = currentAttempt(attempt);
      if (
        latest &&
        latest.enteredAt === attempt.enteredAt &&
        officialResult(latest) === sentResult
      ) {
        setAttemptSync(
          competitionId,
          group.key,
          person.registrantId,
          attempt.roundId,
          attempt.attemptNumber,
          { syncStatus: "synced", syncError: undefined, remoteResult: undefined },
        );
      }
    } catch (error) {
      const latest = currentAttempt(attempt);
      if (latest?.enteredAt === attempt.enteredAt) {
        setAttemptSync(
          competitionId,
          group.key,
          person.registrantId,
          attempt.roundId,
          attempt.attemptNumber,
          {
            syncStatus: "failed",
            syncError: error instanceof Error ? error.message : "WCA Live submission failed.",
            remoteResult: latest.remoteResult,
          },
        );
      }
    }
  };

  const commitAttempt = (attempt: TrackedAttempt) => {
    if (!group || !person) return;
    updateAttempt(competitionId, group.key, person.registrantId, attempt);
    if (liveToken && online && attempt.outcome !== "skipped" && !attempt.estimated) {
      void submitAttempt({ ...attempt, syncStatus: "local" });
    }
  };

  const confirmAction = () => {
    if (!budget || !group) {
      setPendingAction(null);
      return;
    }
    if (pendingAction === "clear") {
      if (fallbackBudget) replaceBudget(competitionId, fallbackBudget);
    } else if (pendingAction === "dns" && nextAttempt) {
      const nextBudget = {
        ...budget,
        attempts: dnsRemainingInRound(budget.attempts, nextAttempt.roundId),
      };
      replaceBudget(competitionId, nextBudget);
      if (liveToken && online) {
        for (const attempt of nextBudget.attempts) {
          if (
            attempt.roundId === nextAttempt.roundId &&
            attempt.outcome === "dns" &&
            attempt.syncStatus === "local"
          ) {
            void submitAttempt(attempt);
          }
        }
      }
    } else if (pendingAction === "stop" && nextAttempt) {
      if (group.cumulative) {
        const nextBudget = stopAttemptAtLimit(
          budget,
          nextAttempt.roundId,
          nextAttempt.attemptNumber,
        );
        replaceBudget(competitionId, nextBudget);
        const stopped = nextBudget.attempts.find(
          (attempt) =>
            attempt.roundId === nextAttempt.roundId &&
            attempt.attemptNumber === nextAttempt.attemptNumber,
        );
        if (stopped && liveToken && online) void submitAttempt(stopped);
      } else {
        commitAttempt({
          ...nextAttempt,
          outcome: "dnf",
          centiseconds: group.limitCentiseconds,
          estimated: false,
          enteredAt: new Date().toISOString(),
        });
      }
    }
    setPendingAction(null);
  };

  return (
    <CompetitionState
      data={query.data}
      error={query.error}
      isLoading={query.isLoading}
      onRetry={() => void query.refetch()}
    >
      {query.data && group && person && budget && summary ? (
        <Stack spacing={4}>
          <Box>
            <Button
              component={Link}
              sx={{ mb: 2 }}
              to={`/c/${encodeURIComponent(competitionId)}/g/${encodeURIComponent(group.key)}`}
            >
              Back to group
            </Button>
            <Typography component="h1" variant="h2">
              {countryFlag(person.countryIso2)} {person.name}
            </Typography>
            <Typography color="text.secondary">
              Registrant #{person.registrantId}
            </Typography>
            {liveToken ? (
              <Chip color="primary" label="WCA Live mode" size="small" sx={{ mt: 1 }} />
            ) : null}
          </Box>

          <Grid aria-live="polite" container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card sx={{ height: "100%" }} variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" variant="overline">
                    Next attempt cap
                  </Typography>
                  <Typography sx={{ fontVariantNumeric: "tabular-nums" }} variant="h3">
                    {summary.isUpperBound && group.cumulative ? "≤ " : ""}
                    {formatTime(
                      Math.max(0, summary.capForNextAttemptCentiseconds),
                      { compact: true },
                    )}
                  </Typography>
                  <Typography color="text.secondary">
                    {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} left
                    {average !== null && remainingAttempts > 1
                      ? ` · avg ${formatTime(average, { compact: true })}`
                      : ""}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card sx={{ height: "100%" }} variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" variant="overline">
                    {group.cumulative ? "Remaining" : "Limit type"}
                  </Typography>
                  {group.cumulative ? (
                    <Typography sx={{ fontVariantNumeric: "tabular-nums" }} variant="h3">
                      {summary.isUpperBound ? "≤ " : ""}
                      {formatTime(Math.max(0, summary.remainingCentiseconds), {
                        compact: true,
                      })}
                    </Typography>
                  ) : (
                    <Typography variant="h4">Per attempt</Typography>
                  )}
                  <Typography color="text.secondary">
                    used {formatTime(summary.usedCentiseconds, { compact: true })}
                    {group.cumulative
                      ? ` of ${formatTime(group.limitCentiseconds, { compact: true })}`
                      : " across entered attempts"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {summary.unknownCount > 0 ? (
            <Alert severity="warning">
              {summary.unknownCount} DNF{summary.unknownCount === 1 ? " is" : "s are"} missing
              elapsed time. The remaining cumulative budget is only an upper bound.
            </Alert>
          ) : null}
          {group.cumulative && summary.exhausted ? (
            <Alert severity="error">The cumulative limit is exhausted.</Alert>
          ) : null}
          {liveToken && !online ? (
            <Alert severity="info">
              You are offline. Attempts stay local; submission is available when the connection
              returns.
            </Alert>
          ) : null}
          {liveToken && liveResults.isError ? (
            <Alert severity="warning">
              WCA Live results could not be refreshed. Local tracking still works.
            </Alert>
          ) : null}

          <Stack divider={<Divider flexItem />} spacing={3}>
            {ordered.map((attempt, index) => {
              const round = group.rounds.find(({ roundId }) => roundId === attempt.roundId);
              const before = group.cumulative
                ? budgetBeforeAttempt(budget, attempt.roundId, attempt.attemptNumber)
                : null;
              return (
                <Stack
                  data-attempt-key={`${attempt.roundId}:${attempt.attemptNumber}`}
                  direction="row"
                  key={`${attempt.roundId}:${attempt.attemptNumber}`}
                  spacing={1}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <AttemptInput
                      attempt={attempt}
                      capCentiseconds={
                        group.cumulative
                          ? Math.max(0, before?.capForNextAttemptCentiseconds ?? 0)
                          : group.limitCentiseconds
                      }
                      label={`${round?.eventName ?? round?.eventId ?? "Event"} · attempt ${attempt.attemptNumber}`}
                      onCommit={commitAttempt}
                      onMove={(direction) => {
                        const fields = document.querySelectorAll<HTMLInputElement>(
                          "[data-attempt-key] input[type='tel']",
                        );
                        fields.item(index + (direction === "next" ? 1 : -1))?.focus();
                      }}
                    />
                    {liveToken && attempt.outcome !== "skipped" ? (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Chip
                            color={
                              attempt.syncStatus === "synced"
                                ? "success"
                                : attempt.syncStatus === "failed"
                                  ? "error"
                                  : attempt.syncStatus === "sending"
                                    ? "primary"
                                    : "default"
                            }
                            label={
                              attempt.estimated
                                ? "Estimate · Local only"
                                : attempt.syncStatus === "synced"
                                  ? "On WCA Live"
                                  : attempt.syncStatus === "sending"
                                    ? "Sending"
                                    : attempt.syncStatus === "failed"
                                      ? "Failed"
                                      : "Local"
                            }
                            icon={
                              attempt.syncStatus === "synced" ? (
                                <CloudDoneOutlined aria-hidden="true" />
                              ) : attempt.syncStatus === "failed" ? (
                                <CloudOffOutlined aria-hidden="true" />
                              ) : attempt.syncStatus === "sending" ? (
                                <HourglassTop aria-hidden="true" />
                              ) : (
                                <SaveOutlined aria-hidden="true" />
                              )
                            }
                            size="small"
                          />
                          {!attempt.estimated &&
                          attempt.syncStatus !== "sending" &&
                          attempt.syncStatus !== "synced" ? (
                            <Button
                              disabled={!online}
                              onClick={() =>
                                void submitAttempt(attempt, attempt.remoteResult !== undefined)
                              }
                              size="small"
                            >
                              {attempt.remoteResult !== undefined
                                ? "Submit mine"
                                : attempt.syncStatus === "failed"
                                  ? "Retry"
                                  : "Submit"}
                            </Button>
                          ) : null}
                          {attempt.remoteResult !== undefined ? (
                            <Button
                              onClick={() => {
                                const remoteResult = attempt.remoteResult;
                                if (remoteResult === undefined) return;
                                replaceBudget(competitionId, {
                                  ...budget,
                                  attempts: budget.attempts.map((current) =>
                                    current.roundId === attempt.roundId &&
                                    current.attemptNumber === attempt.attemptNumber
                                      ? takeRemoteAttempt(current, remoteResult)
                                      : current,
                                  ),
                                });
                              }}
                              size="small"
                            >
                              Take WCA Live
                            </Button>
                          ) : null}
                        </Stack>
                        {attempt.remoteResult !== undefined ? (
                          <Alert severity="warning">
                            WCA Live has {formatOfficialResult(attempt.remoteResult)} for this
                            attempt. Choose which value to keep.
                          </Alert>
                        ) : null}
                        {attempt.syncError ? (
                          <Alert severity="error">{attempt.syncError}</Alert>
                        ) : null}
                        {attempt.changedRemotely ? (
                          <Alert severity="info">This attempt was changed on WCA Live.</Alert>
                        ) : null}
                      </Stack>
                    ) : null}
                  </Box>
                  {group.rounds.length > 1 ? (
                    <Stack>
                      <IconButton
                        aria-label={`Move ${round?.eventName ?? "attempt"} attempt ${attempt.attemptNumber} earlier`}
                        disabled={index === 0}
                        onClick={() => {
                          if (index === 0) return;
                          const keys = ordered.map(
                            (item) => `${item.roundId}:${item.attemptNumber}`,
                          );
                          [keys[index - 1], keys[index]] = [keys[index]!, keys[index - 1]!];
                          replaceBudget(competitionId, {
                            ...budget,
                            attempts: reorderAttempts(budget.attempts, keys),
                          });
                        }}
                      >
                        <ArrowUpward />
                      </IconButton>
                      <IconButton
                        aria-label={`Move ${round?.eventName ?? "attempt"} attempt ${attempt.attemptNumber} later`}
                        disabled={index === ordered.length - 1}
                        onClick={() => {
                          if (index === ordered.length - 1) return;
                          const keys = ordered.map(
                            (item) => `${item.roundId}:${item.attemptNumber}`,
                          );
                          [keys[index], keys[index + 1]] = [keys[index + 1]!, keys[index]!];
                          replaceBudget(competitionId, {
                            ...budget,
                            attempts: reorderAttempts(budget.attempts, keys),
                          });
                        }}
                      >
                        <ArrowDownward />
                      </IconButton>
                    </Stack>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              disabled={
                !nextAttempt ||
                (group.cumulative && (summary.isUpperBound || summary.exhausted))
              }
              onClick={() => setPendingAction("stop")}
              variant="contained"
            >
              Stopped at the limit
            </Button>
            {group.cumulative ? (
              <Button
                color="warning"
                disabled={!nextAttempt || !summary.exhausted}
                onClick={() => setPendingAction("dns")}
                variant="outlined"
              >
                DNS the rest
              </Button>
            ) : null}
            <Button color="error" onClick={() => setPendingAction("clear")}>
              Clear competitor
            </Button>
          </Stack>

          <ConfirmActionDialog
            confirmLabel={
              pendingAction === "clear"
                ? "Clear attempts"
                : pendingAction === "dns"
                  ? "Mark DNS"
                  : "Record DNF"
            }
            description={
              pendingAction === "clear"
                ? `Every locally tracked attempt for ${person.name} in this group will be cleared.`
                : pendingAction === "dns"
                  ? `Every skipped attempt remaining in ${group.rounds.find(({ roundId }) => roundId === nextAttempt?.roundId)?.eventName ?? "this round"} will be marked DNS. Other rounds are unchanged.`
                  : `The next attempt will be recorded as DNF at exactly ${formatTime(group.cumulative ? summary.remainingCentiseconds : group.limitCentiseconds, { compact: true })}.`
            }
            onCancel={() => setPendingAction(null)}
            onConfirm={confirmAction}
            open={pendingAction !== null}
            title={
              pendingAction === "clear"
                ? "Clear this competitor?"
                : pendingAction === "dns"
                  ? "DNS the remaining attempts?"
                  : "Stop this attempt at the limit?"
            }
          />
        </Stack>
      ) : query.data ? (
        <Typography>That competitor or time-limit group was not found.</Typography>
      ) : null}
    </CompetitionState>
  );
}

function formatOfficialResult(result: number): string {
  if (result === -1) return "DNF";
  if (result === -2) return "DNS";
  return formatTime(result, { compact: true });
}
