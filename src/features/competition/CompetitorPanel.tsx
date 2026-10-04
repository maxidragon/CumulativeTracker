import { ArrowDownward, ArrowUpward, DragIndicator } from "@mui/icons-material";
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
import { ConfirmActionDialog } from "../../components/ConfirmActionDialog";
import { EventIcon } from "../../components/EventIcon";
import { formatTime, type TrackedAttempt } from "../../lib/attempt";
import { budgetBeforeAttempt } from "../../lib/cumulative";
import type { CompetitionGroup } from "../../lib/wca";
import type { ScoretakingToken } from "../../lib/wcaLive";
import { AttemptInput } from "../entry/AttemptInput";
import { SyncStatus } from "./SyncStatus";
import { useCompetitorEntry, type CompetitorAction } from "./useCompetitorEntry";
import { attemptSyncLabel } from "./viewModel";

type CompetitorPanelProps = {
  competitionId: string;
  group: CompetitionGroup;
  person: Person;
  liveToken: ScoretakingToken | null;
  /** Bump to put the cursor on the next empty attempt again, e.g. for the same competitor. */
  focusRequest: number;
  /** Escape on an unchanged attempt: back to the competitor search, scorecard kept open. */
  onExit: () => void;
  /** The scorecard is finished (and on WCA Live, in live mode): close it. */
  onConfirmed: () => void;
};

function formatOfficialResult(result: number): string {
  if (result === -1) return "DNF";
  if (result === -2) return "DNS";
  return formatTime(result);
}

const attemptKey = (attempt: TrackedAttempt) => `${attempt.roundId}:${attempt.attemptNumber}`;

export function CompetitorPanel({
  competitionId,
  group,
  person,
  liveToken,
  focusRequest,
  onExit,
  onConfirmed,
}: CompetitorPanelProps) {
  const entry = useCompetitorEntry(competitionId, group, person, liveToken);
  const { budget, summary, ordered, nextAttempt } = entry;
  const [pendingAction, setPendingAction] = useState<CompetitorAction | null>(null);
  const attemptsRef = useRef<HTMLDivElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const refocusKey = useRef<string | null>(null);
  const orderSignature = ordered.map(attemptKey).join(",");
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

  // Reordering moves the row's DOM node, which drops focus; put it back on the moved attempt.
  useEffect(() => {
    if (refocusKey.current === null) return;
    attemptsRef.current
      ?.querySelector<HTMLInputElement>(
        `[data-attempt-key="${refocusKey.current}"] input[type='tel']`,
      )
      ?.focus();
    refocusKey.current = null;
  }, [orderSignature]);

  const anyEntered = budget.attempts.some(({ outcome }) => outcome !== "skipped");
  const nextRound = group.rounds.find(({ roundId }) => roundId === nextAttempt?.roundId);
  const multiRound = group.rounds.length > 1;

  const [submitting, setSubmitting] = useState(false);
  const confirm = async () => {
    if (!liveToken) {
      onConfirmed();
      return;
    }
    if (!entry.canSubmit || submitting) return;
    setSubmitting(true);
    const done = await entry.submitPending();
    setSubmitting(false);
    if (done) onConfirmed();
  };

  const dialog: Record<CompetitorAction, { title: string; confirm: string; description: string }> = {
    stop: {
      title: "Stop this attempt at the limit?",
      confirm: "Record DNF",
      description: group.cumulative
        ? `The next attempt will be recorded as DNF at exactly ${formatTime(Math.max(0, summary.remainingCentiseconds))}, and the rest of ${nextRound ? `${nextRound.eventName} ${nextRound.roundLabel}` : "this round"} as DNS.`
        : `The next attempt will be recorded as DNF at exactly ${formatTime(group.limitCentiseconds)}.`,
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
    <Stack spacing={2}>
      {group.cumulative ? (
        <Stack
          aria-label="Cumulative limit used and remaining"
          aria-live="polite"
          direction="row"
          role="group"
          spacing={3}
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          <Typography>
            <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
              Used
            </Box>
            <strong>{formatTime(summary.usedCentiseconds)}</strong>
          </Typography>
          <Typography>
            <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
              Remaining
            </Box>
            <strong>
              {summary.isUpperBound ? "≤ " : ""}
              {formatTime(Math.max(0, summary.remainingCentiseconds))}
            </strong>
          </Typography>
        </Stack>
      ) : null}

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
        <Typography color="text.secondary" variant="body2">
          In the order they were done. Drag, use the arrows or Alt+↑ / Alt+↓ to reorder.
        </Typography>
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
                  onExit={onExit}
                  onMove={(direction, via) => {
                    if (via === "enter" && direction === "next" && index === ordered.length - 1) {
                      void confirm();
                      return;
                    }
                    attemptFields()[index + (direction === "next" ? 1 : -1)]?.focus();
                  }}
                  onReorder={
                    multiRound
                      ? (direction) => {
                          entry.moveAttempt(index, index + (direction === "earlier" ? -1 : 1));
                          refocusKey.current = attemptKey(attempt);
                        }
                      : undefined
                  }
                />
                {liveToken && attempt.outcome !== "skipped" ? (
                  <AttemptSync
                    attempt={attempt}
                    online={entry.online}
                    onKeepMine={() => void entry.submitAttempt(attempt, true)}
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
                    tabIndex={-1}
                    title="Done earlier (Alt+↑ in the field)"
                  >
                    <ArrowUpward />
                  </IconButton>
                  <IconButton
                    aria-label={`Move ${eventName} attempt ${attempt.attemptNumber} later`}
                    disabled={index === ordered.length - 1}
                    onClick={() => entry.moveAttempt(index, index + 1)}
                    tabIndex={-1}
                    title="Done later (Alt+↓ in the field)"
                  >
                    <ArrowDownward />
                  </IconButton>
                </Stack>
              ) : null}
            </Stack>
          );
        })}
      </Stack>

      <Button
        disabled={liveToken !== null && (!entry.canSubmit || submitting)}
        fullWidth
        onClick={() => void confirm()}
        size="large"
        variant="contained"
      >
        {liveToken ? (submitting ? "Submitting…" : "Submit to WCA Live") : "Done"}
      </Button>

      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button
          disabled={
            !nextAttempt || (group.cumulative && (summary.isUpperBound || summary.exhausted))
          }
          onClick={() => setPendingAction("stop")}
          variant="outlined"
        >
          Stopped at the limit
        </Button>
        {group.cumulative ? (
          <Button
            color="warning"
            disabled={!nextAttempt || !anyEntered}
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
  onKeepMine,
  onTakeRemote,
}: {
  attempt: TrackedAttempt;
  online: boolean;
  onKeepMine: () => void;
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
  return (
    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
      <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <SyncStatus label={attemptSyncLabel(attempt)} />
        {conflict !== undefined ? (
          <>
            <Button disabled={!online} onClick={onKeepMine} size="small">
              Submit mine
            </Button>
            <Button onClick={onTakeRemote} size="small">
              Take WCA Live
            </Button>
          </>
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
