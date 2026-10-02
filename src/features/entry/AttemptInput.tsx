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

export type AttemptInputProps = {
  attempt: TrackedAttempt;
  capCentiseconds?: number;
  disabled?: boolean;
  label?: string;
  onCommit: (attempt: TrackedAttempt) => void;
  onMove?: (direction: "next" | "previous") => void;
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

    const next: TrackedAttempt = {
      ...attempt,
      outcome: committedOutcome,
      centiseconds,
      estimated: estimated && centiseconds !== null,
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

  const draftDigits = draftInput.replace(/\D/g, "");

  const appendDigits = (digits: string) => {
    setDraftInput(formatTimeInput(`${draftDigits}${digits}`));
    if (draftOutcome === "skipped") setDraftOutcome("ok");
  };

  const removeLastDigit = () => setDraftInput(formatTimeInput(draftDigits.slice(0, -1)));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
      onMove?.(event.shiftKey ? "previous" : "next");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
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

  const elapsed = parseTimeDraft(draftInput);
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
          slotProps={{ htmlInput: { inputMode: "numeric", spellCheck: false } }}
          sx={{ flex: { xs: "1 1 100%", sm: "1 1 200px" }, maxWidth: { sm: 320 } }}
          type="tel"
          value={draftInput}
        />
        <Stack direction="row" sx={{ whiteSpace: "nowrap" }}>
          <FormControlLabel
            control={
              <Checkbox checked={draftOutcome === "dnf"} onChange={toggleDnf} size={size} />
            }
            label="DNF"
          />
          <FormControlLabel
            control={
              <Checkbox checked={draftOutcome === "dns"} onChange={toggleDns} size={size} />
            }
            label="DNS"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={draftEstimated}
                disabled={elapsed === null || draftOutcome === "dns"}
                onChange={() => {
                  const next = !draftEstimated;
                  setDraftEstimated(next);
                  commit(draftOutcome, draftInput, next);
                }}
                size={size}
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
