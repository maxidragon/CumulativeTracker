import {
  FormControl,
  FormHelperText,
  Stack,
  TextField,
  ToggleButton,
} from "@mui/material";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useState } from "react";
import {
  autocompleteTime,
  formatTime,
  formatTimeInput,
  parseTimeDraft,
  parseTimeInput,
  type Outcome,
  type TrackedAttempt,
} from "../../lib/attempt";

const DNF_KEYS = new Set(["d", "D", "/", "#"]);
const DNS_KEYS = new Set(["s", "S", "*"]);

export type AttemptInputProps = {
  attempt: TrackedAttempt;
  capCentiseconds?: number;
  disabled?: boolean;
  label?: string;
  onCommit: (attempt: TrackedAttempt) => void;
  /** `via` tells Enter (which may finish a scorecard) from the arrow keys (which only move). */
  onMove?: (direction: "next" | "previous", via: "enter" | "arrow") => void;
  /** Escape on a field with nothing to revert. */
  onExit?: () => void;
  /** Alt+↑ / Alt+↓; only where attempts can be reordered. */
  onReorder?: (direction: "earlier" | "later") => void;
};

function inputValue(attempt: TrackedAttempt): string {
  return attempt.centiseconds === null
    ? ""
    : formatTime(attempt.centiseconds);
}

export function AttemptInput({
  attempt,
  capCentiseconds,
  disabled = false,
  label = `Attempt ${attempt.attemptNumber}`,
  onCommit,
  onMove,
  onExit,
  onReorder,
}: AttemptInputProps) {
  const [draftInput, setDraftInput] = useState(() => inputValue(attempt));
  const [draftOutcome, setDraftOutcome] = useState(attempt.outcome);
  const revision = `${attempt.outcome}:${attempt.centiseconds ?? ""}:${attempt.enteredAt}`;
  const [previousRevision, setPreviousRevision] = useState(revision);

  if (previousRevision !== revision) {
    setPreviousRevision(revision);
    setDraftInput(inputValue(attempt));
    setDraftOutcome(attempt.outcome);
  }

  const commit = (outcome = draftOutcome, value = draftInput) => {
    const parsed = outcome === "dns" ? null : parseTimeDraft(value);
    const centiseconds = parsed === null ? null : autocompleteTime(parsed);
    let committedOutcome: Outcome = outcome;

    if (outcome !== "dnf" && outcome !== "dns") {
      committedOutcome = centiseconds === null ? "skipped" : "ok";
    }

    const unchanged =
      committedOutcome === attempt.outcome &&
      centiseconds === attempt.centiseconds &&
      !attempt.auto;
    // Arrowing or tabbing through filled fields commits each one; an unchanged attempt must
    // not get a new timestamp or another WCA Live submission.
    if (unchanged) {
      setDraftInput(inputValue(attempt));
      setDraftOutcome(attempt.outcome);
      return;
    }

    const next: TrackedAttempt = {
      ...attempt,
      outcome: committedOutcome,
      centiseconds,
      estimated: false,
      enteredAt:
        committedOutcome === "skipped" ? attempt.enteredAt : new Date().toISOString(),
      auto: false,
    };
    setDraftInput(inputValue(next));
    setDraftOutcome(next.outcome);
    onCommit(next);
  };

  const toggleDnf = () => {
    const nextOutcome: Outcome =
      draftOutcome === "dnf"
        ? parseTimeDraft(draftInput) === null
          ? "skipped"
          : "ok"
        : "dnf";
    setDraftOutcome(nextOutcome);
    commit(nextOutcome);
  };

  const toggleDns = () => {
    if (draftOutcome === "dns") {
      setDraftOutcome("skipped");
      commit("skipped", "");
    } else {
      setDraftInput("");
      setDraftOutcome("dns");
      commit("dns", "");
    }
  };

  const elapsed = parseTimeDraft(draftInput);
  const draftDigits = draftInput.replace(/\D/g, "");

  const appendDigits = (digits: string) => {
    setDraftInput(formatTimeInput(`${draftDigits}${digits}`));
    if (draftOutcome === "skipped") setDraftOutcome("ok");
  };

  const removeLastDigit = () => setDraftInput(formatTimeInput(draftDigits.slice(0, -1)));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (vertical && event.altKey) {
      if (!onReorder) return;
      event.preventDefault();
      commit();
      onReorder(event.key === "ArrowUp" ? "earlier" : "later");
      return;
    }
    if (vertical) {
      event.preventDefault();
      commit();
      onMove?.(event.key === "ArrowUp" ? "previous" : "next", "arrow");
      return;
    }
    if (DNF_KEYS.has(event.key)) {
      event.preventDefault();
      toggleDnf();
      return;
    }
    if (DNS_KEYS.has(event.key)) {
      event.preventDefault();
      toggleDns();
      return;
    }
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      appendDigits(event.key);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      removeLastDigit();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      onMove?.(event.shiftKey ? "previous" : "next", "enter");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      const unchanged =
        draftInput === inputValue(attempt) && draftOutcome === attempt.outcome;
      if (unchanged) {
        onExit?.();
        return;
      }
      setDraftInput(inputValue(attempt));
      setDraftOutcome(attempt.outcome);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (nativeEvent.inputType === "deleteContentBackward") {
      removeLastDigit();
      return;
    }
    if (nativeEvent.data && /^\d+$/.test(nativeEvent.data)) {
      appendDigits(nativeEvent.data);
      return;
    }

    const parsed = parseTimeInput(event.target.value);
    setDraftInput(
      parsed === null
        ? formatTimeInput(event.target.value)
        : formatTime(parsed),
    );
  };

  const isOverCap =
    capCentiseconds !== undefined && elapsed !== null && elapsed > capCentiseconds;
  // Only what needs action: an untimed DNF, or a time over the cap.
  const helperText =
    draftOutcome === "dnf" && elapsed === null
      ? "Elapsed time not recorded"
      : isOverCap
        ? `Over the ${formatTime(capCentiseconds)} cap`
        : null;

  // Out of the tab order so Tab goes field to field, as in WCA Live; D and S toggle these
  // from the field.
  const outcomeToggle = (outcome: "dnf" | "dns", onToggle: () => void) => (
    <ToggleButton
      color={outcome === "dnf" ? "error" : "warning"}
      disabled={disabled}
      onChange={onToggle}
      selected={draftOutcome === outcome}
      sx={{ fontWeight: 700, px: 2 }}
      tabIndex={-1}
      value={outcome}
    >
      {outcome.toUpperCase()}
    </ToggleButton>
  );

  return (
    <FormControl disabled={disabled} fullWidth>
      <Stack direction="row" spacing={1} sx={{ alignItems: "stretch" }}>
        <TextField
          disabled={disabled || draftOutcome === "dns"}
          label={label}
          onBlur={() => commit()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          slotProps={{
            htmlInput: {
              "aria-keyshortcuts": onReorder
                ? "D S ArrowUp ArrowDown Alt+ArrowUp Alt+ArrowDown"
                : "D S ArrowUp ArrowDown",
              inputMode: "numeric",
              spellCheck: false,
              sx: {
                fontSize: 22,
                fontVariantNumeric: "tabular-nums",
                py: 1.75,
              },
            },
          }}
          sx={{ flexGrow: 1, minWidth: 0 }}
          type="tel"
          value={draftInput}
        />
        {outcomeToggle("dnf", toggleDnf)}
        {outcomeToggle("dns", toggleDns)}
      </Stack>
      {helperText ? (
        <FormHelperText
          sx={{ mx: 0, ...(isOverCap ? { color: "warning.main" } : {}) }}
        >
          {helperText}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
}
