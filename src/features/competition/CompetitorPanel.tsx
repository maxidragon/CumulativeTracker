import { ArrowDownward, ArrowUpward, Close, DragIndicator } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import type { Person } from "@wca/helpers";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmActionDialog } from "../../components/ConfirmActionDialog";
import { EventIcon } from "../../components/EventIcon";
import { Stat } from "../../components/Stat";
import { formatTime, type TrackedAttempt } from "../../lib/attempt";
import { budgetBeforeAttempt } from "../../lib/cumulative";
import type { CompetitionGroup } from "../../lib/wca";
import type { ScoretakingToken } from "../../lib/wcaLive";
import { AttemptInput } from "../entry/AttemptInput";
import { SyncStatus } from "./SyncStatus";
import { useCompetitorEntry, type CompetitorAction } from "./useCompetitorEntry";
import { attemptSyncLabel, countryFlag } from "./viewModel";

type CompetitorPanelProps = {
  competitionId: string;
  group: CompetitionGroup;
  person: Person;
  liveToken: ScoretakingToken | null;
  /** Bump to put the cursor on the next empty attempt again, e.g. for the same competitor. */
  focusRequest: number;
  closeTo: string;
  /** Enter on the last attempt: the scorecard is done. */
  onDone: () => void;
};

function formatOfficialResult(result: number): string {
  if (result === -1) return "DNF";
  if (result === -2) return "DNS";
  return formatTime(result, { compact: true });
}

const attemptKey = (attempt: TrackedAttempt) => `${attempt.roundId}:${attempt.attemptNumber}`;

export function CompetitorPanel({
  competitionId,
  group,
  person,
  liveToken,
  focusRequest,
  closeTo,
  onDone,
}: CompetitorPanelProps) {
  const entry = useCompetitorEntry(competitionId, group, person, liveToken);
  const { budget, summary, ordered, nextAttempt } = entry;
  const [pendingAction, setPendingAction] = useState<CompetitorAction | null>(null);
  const attemptsRef = useRef<HTMLDivElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const nextKey = nextAttempt ? attemptKey(nextAttempt) : null;

  const attemptFields = () =>
    attemptsRef.current?.querySelectorAll<HTMLInputElement>(
      "[data-attempt-key] input[type='tel']",
    ) ?? [];

  useEffect(() => {
    const target = nextKey
      ? attemptsRef.current?.querySelector<HTMLInputElement>(
          `[data-attempt-key="${nextKey}"] input[type='tel']`,
        )
      : attemptFields()[0];
    target?.focus();
    // Opening a competitor or a new request moves the cursor; entering a time (which
    // changes the next attempt) must not, or Enter-to-advance would fight it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, person.registrantId]);

  const limitNote = summary.isUpperBound && group.cumulative ? "≤ " : "";
  const nextRound = group.rounds.find(({ roundId }) => roundId === nextAttempt?.roundId);
  const multiRound = group.rounds.length > 1;

  const dialog: Record<CompetitorAction, { title: string; confirm: string; description: string }> = {
    stop: {
      title: "Stop this attempt at the limit?",
      confirm: "Record DNF",
      description: `The next attempt will be recorded as DNF at exactly ${formatTime(group.cumulative ? Math.max(0, summary.remainingCentiseconds) : group.limitCentiseconds, { compact: true })}.`,
    },
    dns: {
      title: "DNS the remaining attempts?",
      confirm: "Mark DNS",
      description: `Every skipped attempt remaining in ${nextRound?.eventName ?? "this round"} will be marked DNS. Other rounds are unchanged.`,
    },
    clear: {
      title: "Clear this competitor?",
      confirm: "Clear attempts",
      description: `Every locally tracked attempt for ${person.name} in this group will be cleared.`,
    },
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontWeight: 700 }} variant="h5">
            {countryFlag(person.countryIso2)} {person.name}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Registrant #{person.registrantId}
          </Typography>
        </Box>
        <IconButton aria-label="Close competitor" component={Link} to={closeTo}>
          <Close />
        </IconButton>
      </Stack>

      <Box
        aria-live="polite"
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr 1fr", sm: "1.3fr 1fr" },
        }}
      >
        <Stat
          caption={
            <>
              {entry.remainingAttempts} attempt{entry.remainingAttempts === 1 ? "" : "s"} left
              {entry.average !== null && entry.remainingAttempts > 1
                ? ` · avg ${formatTime(entry.average, { compact: true })}`
                : ""}
            </>
          }
          emphasis
          label="Next attempt cap"
          value={`${limitNote}${formatTime(Math.max(0, summary.capForNextAttemptCentiseconds), { compact: true })}`}
        />
        {group.cumulative ? (
          <Stat
            caption={`used ${formatTime(summary.usedCentiseconds, { compact: true })} of ${formatTime(group.limitCentiseconds, { compact: true })}`}
            label="Remaining"
            value={`${limitNote}${formatTime(Math.max(0, summary.remainingCentiseconds), { compact: true })}`}
          />
        ) : (
          <Stat
            caption={`used ${formatTime(summary.usedCentiseconds, { compact: true })} across entered attempts`}
            label="Limit type"
            value="Per attempt"
          />
        )}
      </Box>

      {summary.unknownCount > 0 ? (
        <Alert severity="warning">
          {summary.unknownCount} DNF{summary.unknownCount === 1 ? " is" : "s are"} missing
          elapsed time. The remaining cumulative budget is only an upper bound.
        </Alert>
      ) : null}
      {group.cumulative && summary.exhausted ? (
        <Alert severity="error">The cumulative limit is exhausted.</Alert>
      ) : null}
      {liveToken && !entry.online ? (
        <Alert severity="info">
          You are offline. Attempts stay local; submission is available when the connection
          returns.
        </Alert>
      ) : null}
      {entry.liveResultsFailed ? (
        <Alert severity="warning">
          WCA Live results could not be refreshed. Local tracking still works.
        </Alert>
      ) : null}

      {multiRound ? (
        <Box>
          <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle1">
            Attempts in the order they were done
          </Typography>
          <Typography color="text.secondary" variant="body2">
            The shared limit is spent in this order. If the competitor did them differently,
            drag an attempt by its handle or use the arrows.
          </Typography>
        </Box>
      ) : null}

      <Stack ref={attemptsRef} spacing={1.5}>
        {ordered.map((attempt, index) => {
          const round = group.rounds.find(({ roundId }) => roundId === attempt.roundId);
          const eventName = round?.eventName ?? round?.eventId ?? "Event";
          const before = group.cumulative
            ? budgetBeforeAttempt(budget, attempt.roundId, attempt.attemptNumber)
            : null;
          const dropping = dropTarget === index && dragFrom !== null && dragFrom !== index;
          return (
            <Stack
              data-attempt-key={attemptKey(attempt)}
              direction="row"
              key={attemptKey(attempt)}
              onDragOver={(event) => {
                if (dragFrom === null) return;
                event.preventDefault();
                setDropTarget(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragFrom !== null) entry.moveAttempt(dragFrom, index);
                setDragFrom(null);
                setDropTarget(null);
              }}
              spacing={1}
              sx={{
                alignItems: "flex-start",
                borderRadius: 1,
                opacity: dragFrom === index ? 0.4 : 1,
                outline: dropping ? 2 : 0,
                outlineColor: "primary.main",
                outlineOffset: 4,
              }}
            >
              {multiRound ? (
                <Stack sx={{ alignItems: "center", pt: 0.5 }}>
                  <Box
                    title={`Done ${index + 1} of ${ordered.length}`}
                    sx={{
                      bgcolor: "primary.main",
                      borderRadius: "50%",
                      color: "primary.contrastText",
                      display: "grid",
                      fontSize: 14,
                      fontWeight: 700,
                      height: 28,
                      placeItems: "center",
                      width: 28,
                    }}
                  >
                    {index + 1}
                  </Box>
                  {round ? <EventIcon eventId={round.eventId} eventName={eventName} /> : null}
                  <Box
                    aria-hidden="true"
                    draggable
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDropTarget(null);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDragFrom(index);
                    }}
                    sx={{ color: "text.secondary", cursor: "grab", display: "flex", py: 0.5 }}
                    title="Drag to reorder"
                  >
                    <DragIndicator />
                  </Box>
                </Stack>
              ) : null}
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <AttemptInput
                  attempt={attempt}
                  capCentiseconds={
                    group.cumulative
                      ? Math.max(0, before?.capForNextAttemptCentiseconds ?? 0)
                      : group.limitCentiseconds
                  }
                  label={
                    multiRound
                      ? `${round?.eventId ?? attempt.roundId} · attempt ${attempt.attemptNumber}`
                      : `Attempt ${attempt.attemptNumber}`
                  }
                  onCommit={entry.commitAttempt}
                  onMove={(direction) => {
                    if (direction === "next" && index === ordered.length - 1) {
                      onDone();
                      return;
                    }
                    attemptFields()[index + (direction === "next" ? 1 : -1)]?.focus();
                  }}
                />
                {liveToken && attempt.outcome !== "skipped" ? (
                  <AttemptSync
                    attempt={attempt}
                    online={entry.online}
                    onSubmit={(overwriteRemote) =>
                      void entry.submitAttempt(attempt, overwriteRemote)
                    }
                    onTakeRemote={() => entry.takeRemote(attempt)}
                  />
                ) : null}
              </Box>
              {multiRound ? (
                <Stack direction="row">
                  <IconButton
                    aria-label={`Move ${eventName} attempt ${attempt.attemptNumber} earlier`}
                    disabled={index === 0}
                    onClick={() => entry.moveAttempt(index, index - 1)}
                    title="Done earlier"
                  >
                    <ArrowUpward />
                  </IconButton>
                  <IconButton
                    aria-label={`Move ${eventName} attempt ${attempt.attemptNumber} later`}
                    disabled={index === ordered.length - 1}
                    onClick={() => entry.moveAttempt(index, index + 1)}
                    title="Done later"
                  >
                    <ArrowDownward />
                  </IconButton>
                </Stack>
              ) : null}
            </Stack>
          );
        })}
      </Stack>

      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button
          disabled={
            !nextAttempt || (group.cumulative && (summary.isUpperBound || summary.exhausted))
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
        <Box sx={{ flexGrow: 1 }} />
        <Button color="error" onClick={() => setPendingAction("clear")}>
          Clear competitor
        </Button>
      </Stack>

      <ConfirmActionDialog
        confirmLabel={pendingAction ? dialog[pendingAction].confirm : ""}
        description={pendingAction ? dialog[pendingAction].description : ""}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) entry.runAction(pendingAction);
          setPendingAction(null);
        }}
        open={pendingAction !== null}
        title={pendingAction ? dialog[pendingAction].title : ""}
      />
    </Stack>
  );
}

function AttemptSync({
  attempt,
  online,
  onSubmit,
  onTakeRemote,
}: {
  attempt: TrackedAttempt;
  online: boolean;
  onSubmit: (overwriteRemote: boolean) => void;
  onTakeRemote: () => void;
}) {
  if (attempt.estimated) {
    return (
      <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
        Estimate · Local only
      </Typography>
    );
  }
  const conflict = attempt.remoteResult;
  const pending = attempt.syncStatus !== "sending" && attempt.syncStatus !== "synced";
  return (
    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
      <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <SyncStatus label={attemptSyncLabel(attempt)} />
        {pending ? (
          <Button disabled={!online} onClick={() => onSubmit(conflict !== undefined)} size="small">
            {conflict !== undefined
              ? "Submit mine"
              : attempt.syncStatus === "failed"
                ? "Retry"
                : "Submit"}
          </Button>
        ) : null}
        {conflict !== undefined ? (
          <Button onClick={onTakeRemote} size="small">
            Take WCA Live
          </Button>
        ) : null}
      </Stack>
      {conflict !== undefined ? (
        <Typography color="warning.main" variant="body2">
          WCA Live has {formatOfficialResult(conflict)} for this attempt. Choose which value to
          keep.
        </Typography>
      ) : null}
      {attempt.syncError ? (
        <Typography color="error" variant="body2">
          {attempt.syncError}
        </Typography>
      ) : null}
      {attempt.changedRemotely ? (
        <Typography color="info.main" variant="body2">
          This attempt was changed on WCA Live.
        </Typography>
      ) : null}
    </Stack>
  );
}
