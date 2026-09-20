import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Stack,
  TextField,
} from "@mui/material";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useState } from "react";
import {
  autocompleteTime,
  formatTime,
  formatTimeInput,
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
    : formatTime(attempt.centiseconds, { preserveCentiseconds: true });
}

export function AttemptInput({
  attempt,
  capCentiseconds,
  disabled = false,
  label = `Attempt ${attempt.attemptNumber}`,
  onCommit,
  onMove,
}: AttemptInputProps) {
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
    const parsed = outcome === "dns" ? null : parseTimeInput(value);
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
        ? parseTimeInput(draftInput) === null
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

  const appendDigits = (digits: string) => {
    const current = parseTimeInput(draftInput) ?? 0;
    const next = Number(`${current}${digits}`);
    setDraftInput(next === 0 ? "" : formatTime(next, { preserveCentiseconds: true }));
    if (draftOutcome === "skipped") setDraftOutcome("ok");
  };

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
      const current = parseTimeInput(draftInput) ?? 0;
      const next = Math.floor(current / 10);
      setDraftInput(next === 0 ? "" : formatTime(next, { preserveCentiseconds: true }));
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
      const current = parseTimeInput(draftInput) ?? 0;
      const next = Math.floor(current / 10);
      setDraftInput(next === 0 ? "" : formatTime(next, { preserveCentiseconds: true }));
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

  const elapsed = parseTimeInput(draftInput);
  const isOverCap =
    capCentiseconds !== undefined && elapsed !== null && elapsed > capCentiseconds;
  const helperText =
    draftOutcome === "dns"
      ? "does not count towards the limit"
      : draftOutcome === "dnf" && elapsed === null
        ? "elapsed time not recorded"
        : elapsed === null
          ? "empty attempts are skipped"
          : `counts ${formatTime(elapsed, { compact: true })} towards the limit${
              isOverCap
                ? ` · over the ${formatTime(capCentiseconds, { compact: true })} cap`
                : ""
            }`;

  return (
    <FormControl disabled={disabled} fullWidth>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}
      >
        <TextField
          disabled={disabled || draftOutcome === "dns"}
          fullWidth
          label={label}
          onBlur={() => commit()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          slotProps={{ htmlInput: { inputMode: "numeric", spellCheck: false } }}
          type="tel"
          value={draftInput}
        />
        <Stack direction="row" sx={{ minHeight: 56, whiteSpace: "nowrap" }}>
          <FormControlLabel
            control={<Checkbox checked={draftOutcome === "dnf"} onChange={toggleDnf} />}
            label="DNF"
          />
          <FormControlLabel
            control={<Checkbox checked={draftOutcome === "dns"} onChange={toggleDns} />}
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
              />
            }
            label="Estimated"
          />
        </Stack>
      </Stack>
      <FormHelperText sx={isOverCap ? { color: "warning.main" } : undefined}>
        {helperText}
      </FormHelperText>
    </FormControl>
  );
}
