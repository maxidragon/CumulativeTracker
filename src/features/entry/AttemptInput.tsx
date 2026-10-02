import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
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
const ESTIMATED_KEYS = new Set(["e", "E"]);

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
    : formatTime(attempt.centiseconds, {
        compact: true,
        preserveCentiseconds: true,
      });
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
  const theme = useTheme();
  const dense = useMediaQuery(theme.breakpoints.up("md"));
  const size = dense ? "small" : "medium";
  const [draftInput, setDraftInput] = useState(() => inputValue(attempt));
  const [draftOutcome, setDraftOutcome] = useState(attempt.outcome);
  const [draftEstimated, setDraftEstimated] = useState(attempt.estimated);
  const revision = `${attempt.outcome}:${attempt.centiseconds ?? ""}:${attempt.estimated}:${attempt.enteredAt}`;
  const [previousRevision, setPreviousRevision] = useState(revision);

  if (previousRevision !== revision) {
    setPreviousRevision(revision);
    setDraftInput(inputValue(attempt));
    setDraftOutcome(attempt.outcome);
    setDraftEstimated(attempt.estimated);
  }

  const commit = (
    outcome = draftOutcome,
    value = draftInput,
    estimated = draftEstimated,
  ) => {
    const parsed = outcome === "dns" ? null : parseTimeDraft(value);
    const centiseconds = parsed === null ? null : autocompleteTime(parsed);
    let committedOutcome: Outcome = outcome;

    if (outcome !== "dnf" && outcome !== "dns") {
      committedOutcome = centiseconds === null ? "skipped" : "ok";
    }

    const committedEstimated = estimated && centiseconds !== null;
    const unchanged =
      committedOutcome === attempt.outcome &&
      centiseconds === attempt.centiseconds &&
      committedEstimated === attempt.estimated &&
      !attempt.auto;
    // Arrowing or tabbing through filled fields commits each one; an unchanged attempt must
    // not get a new timestamp or another WCA Live submission.
    if (unchanged) {
      setDraftInput(inputValue(attempt));
      setDraftOutcome(attempt.outcome);
      setDraftEstimated(attempt.estimated);
      return;
    }

    const next: TrackedAttempt = {
      ...attempt,
      outcome: committedOutcome,
      centiseconds,
      estimated: committedEstimated,
      enteredAt:
        committedOutcome === "skipped" ? attempt.enteredAt : new Date().toISOString(),
      auto: false,
    };
    setDraftInput(inputValue(next));
    setDraftOutcome(next.outcome);
    setDraftEstimated(next.estimated);
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
      commit("skipped", "", false);
    } else {
      setDraftInput("");
      setDraftOutcome("dns");
      setDraftEstimated(false);
      commit("dns", "", false);
    }
  };

  const toggleEstimated = () => {
    const next = !draftEstimated;
    setDraftEstimated(next);
    commit(draftOutcome, draftInput, next);
  };

  const elapsed = parseTimeDraft(draftInput);
  const canEstimate = elapsed !== null && draftOutcome !== "dns";
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
    if (ESTIMATED_KEYS.has(event.key)) {
      event.preventDefault();
      if (canEstimate) toggleEstimated();
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
        draftInput === inputValue(attempt) &&
        draftOutcome === attempt.outcome &&
        draftEstimated === attempt.estimated;
      if (unchanged) {
        onExit?.();
        return;
      }
      setDraftInput(inputValue(attempt));
      setDraftOutcome(attempt.outcome);
      setDraftEstimated(attempt.estimated);
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
        : formatTime(parsed, { preserveCentiseconds: true }),
    );
  };

  const isOverCap =
    capCentiseconds !== undefined && elapsed !== null && elapsed > capCentiseconds;
  // Nothing to say about an empty attempt; silence keeps a scorecard's worth of rows compact.
  const helperText =
    draftOutcome === "dns"
      ? "does not count towards the limit"
      : draftOutcome === "dnf" && elapsed === null
        ? "elapsed time not recorded"
        : elapsed === null
          ? null
          : `counts ${formatTime(elapsed, { compact: true })} towards the limit${
              isOverCap
                ? ` · over the ${formatTime(capCentiseconds, { compact: true })} cap`
                : ""
            }`;

  return (
    <FormControl disabled={disabled} fullWidth>
      <Stack
        direction="row"
        sx={{ alignItems: "center", columnGap: 1, flexWrap: "wrap", rowGap: 0.5 }}
      >
        <TextField
          disabled={disabled || draftOutcome === "dns"}
          label={label}
          onBlur={() => commit()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          size={size}
          slotProps={{
            htmlInput: {
              "aria-keyshortcuts": onReorder
                ? "D S E ArrowUp ArrowDown Alt+ArrowUp Alt+ArrowDown"
                : "D S E ArrowUp ArrowDown",
              inputMode: "numeric",
              spellCheck: false,
            },
          }}
          sx={{ flex: { xs: "1 1 100%", sm: "1 1 200px" }, maxWidth: { sm: 320 } }}
          type="tel"
          value={draftInput}
        />
        {/* Out of the tab order so Tab goes field to field, as in WCA Live; D, S and E
            toggle these from the field. */}
        <Stack direction="row" sx={{ whiteSpace: "nowrap" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={draftOutcome === "dnf"}
                onChange={toggleDnf}
                size={size}
                tabIndex={-1}
              />
            }
            label="DNF"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={draftOutcome === "dns"}
                onChange={toggleDns}
                size={size}
                tabIndex={-1}
              />
            }
            label="DNS"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={draftEstimated}
                disabled={!canEstimate}
                onChange={toggleEstimated}
                size={size}
                tabIndex={-1}
              />
            }
            label="Estimated"
          />
        </Stack>
        {helperText ? (
          <FormHelperText
            sx={{ flex: "1 1 160px", m: 0, ...(isOverCap ? { color: "warning.main" } : {}) }}
          >
            {helperText}
          </FormHelperText>
        ) : null}
      </Stack>
    </FormControl>
  );
}
