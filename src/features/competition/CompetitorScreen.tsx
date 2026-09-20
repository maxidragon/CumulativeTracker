import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmActionDialog } from "../../components/ConfirmActionDialog";
import { formatTime, type TrackedAttempt } from "../../lib/attempt";
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
  const tracking = useTrackingStore((state) => state.competitions[competitionId]);
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

  const commitAttempt = (attempt: TrackedAttempt) => {
    if (!group || !person) return;
    updateAttempt(competitionId, group.key, person.registrantId, attempt);
  };

  const confirmAction = () => {
    if (!budget || !group) {
      setPendingAction(null);
      return;
    }
    if (pendingAction === "clear") {
      if (fallbackBudget) replaceBudget(competitionId, fallbackBudget);
    } else if (pendingAction === "dns" && nextAttempt) {
      replaceBudget(competitionId, {
        ...budget,
        attempts: dnsRemainingInRound(budget.attempts, nextAttempt.roundId),
      });
    } else if (pendingAction === "stop" && nextAttempt) {
      if (group.cumulative) {
        replaceBudget(
          competitionId,
          stopAttemptAtLimit(
            budget,
            nextAttempt.roundId,
            nextAttempt.attemptNumber,
          ),
        );
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
