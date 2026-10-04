import { RestartAlt } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { ConfirmActionDialog } from "../../components/ConfirmActionDialog";
import { Stat } from "../../components/Stat";
import { formatTime } from "../../lib/attempt";
import {
  attemptsLeft,
  budgetBeforeAttempt,
  deriveBudget,
  dnsRemainingInRound,
  orderedAttempts,
  stopAttemptAtLimit,
  type Budget,
} from "../../lib/cumulative";
import { AttemptInput } from "../entry/AttemptInput";
import {
  calculatorLimitPresets,
  clearCalculatorAttempts,
  createCustomCalculatorState,
  type CalculatorState,
} from "./model";
import { useCalculatorStore } from "./store";
import { TimeSettingField } from "./TimeSettingField";

type PendingAction =
  | { kind: "replace"; state: CalculatorState; description: string }
  | { kind: "reset"; description: string }
  | { kind: "stop"; roundId: string; attemptNumber: number; description: string }
  | { kind: "dns"; roundId: string; description: string };

const dialogText: Record<PendingAction["kind"], { title: string; confirm: string }> = {
  replace: { title: "Change calculator setup?", confirm: "Clear and change" },
  reset: { title: "Reset the calculator?", confirm: "Reset" },
  stop: { title: "Stop this attempt at the limit?", confirm: "Record DNF" },
  dns: { title: "DNS the remaining attempts?", confirm: "Mark DNS" },
};

export function CalculatorScreen() {
  const calculator = useCalculatorStore((state) => state.calculator);
  const replaceCalculator = useCalculatorStore((state) => state.replaceCalculator);
  const updateAttempt = useCalculatorStore((state) => state.updateAttempt);
  const updateLimits = useCalculatorStore((state) => state.updateLimits);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [customLimit, setCustomLimit] = useState(
    !calculatorLimitPresets.some(
      (minutes) => minutes * 6_000 === calculator.limitCentiseconds,
    ),
  );
  const [customAttempts, setCustomAttempts] = useState(
    ![1, 2, 3, 5].includes(calculator.attempts.length),
  );
  const [customAttemptsDraft, setCustomAttemptsDraft] = useState(
    String(calculator.attempts.length),
  );
  const [customAttemptsError, setCustomAttemptsError] = useState(false);

  const budget: Budget = useMemo(
    () => ({
      groupKey: calculator.rounds.map(({ roundId }) => roundId).sort().join("+"),
      limitCentiseconds: calculator.limitCentiseconds,
      perAttemptLimitCentiseconds: calculator.perAttemptLimitCentiseconds,
      registrantId: 0,
      attempts: calculator.attempts,
    }),
    [calculator],
  );
  const summary = deriveBudget(budget);
  const plans = calculator.rounds.map((round) => ({
    ...round,
    cutoff: null,
    registered: true,
  }));
  const remainingAttempts = attemptsLeft(plans, calculator.attempts);
  const nextAttempt = orderedAttempts(calculator.attempts).find(
    ({ outcome }) => outcome === "skipped",
  );
  const enteredCount = calculator.attempts.filter(
    ({ outcome }) => outcome !== "skipped",
  ).length;

  const requestReplacement = (state: CalculatorState) => {
    if (enteredCount === 0) {
      replaceCalculator(state);
      return;
    }
    setPendingAction({
      kind: "replace",
      state,
      description: `This changes the calculator setup and clears ${enteredCount} entered attempt${enteredCount === 1 ? "" : "s"}.`,
    });
  };

  const commitCustomAttempts = () => {
    const count = Number(customAttemptsDraft);
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
      setCustomAttemptsError(true);
      return;
    }
    setCustomAttemptsError(false);
    const next = createCustomCalculatorState(
      undefined,
      count,
      calculator.limitCentiseconds,
    );
    next.perAttemptLimitCentiseconds = calculator.perAttemptLimitCentiseconds;
    requestReplacement(next);
  };

  const runPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "replace") {
      replaceCalculator(pendingAction.state);
    } else if (pendingAction.kind === "reset") {
      replaceCalculator(clearCalculatorAttempts(calculator));
    } else if (pendingAction.kind === "stop") {
      replaceCalculator({
        ...calculator,
        attempts: stopAttemptAtLimit(
          budget,
          pendingAction.roundId,
          pendingAction.attemptNumber,
        ).attempts,
      });
    } else {
      replaceCalculator({
        ...calculator,
        attempts: dnsRemainingInRound(calculator.attempts, pendingAction.roundId),
      });
    }
    setPendingAction(null);
  };

  const customRound = calculator.rounds[0];
  const isCustomLimit =
    customLimit ||
    !calculatorLimitPresets.some(
      (minutes) => minutes * 6_000 === calculator.limitCentiseconds,
    );
  const upperBound = summary.isUpperBound ? "≤ " : "";

  return (
    <Stack spacing={3} sx={{ maxWidth: 1040 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography component="h1" sx={{ flexGrow: 1 }} variant="h4">
          Calculator
        </Typography>
        <Button
          disabled={enteredCount === 0}
          onClick={() =>
            setPendingAction({
              kind: "reset",
              description: `This clears ${enteredCount} entered attempt${enteredCount === 1 ? "" : "s"}. The limit and the number of attempts stay as they are.`,
            })
          }
          startIcon={<RestartAlt />}
        >
          Reset
        </Button>
      </Stack>

      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: { xs: 3, md: 5 },
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "300px minmax(0, 1fr)" },
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={2}>
            {customRound ? (
              <>
                <Box>
                  <FormControl fullWidth>
                    <InputLabel id="limit-preset-label">Cumulative limit</InputLabel>
                    <Select
                      label="Cumulative limit"
                      labelId="limit-preset-label"
                      onChange={(event) => {
                        if (event.target.value === "custom") {
                          setCustomLimit(true);
                          return;
                        }
                        const minutes = Number(event.target.value);
                        if (!Number.isFinite(minutes)) return;
                        setCustomLimit(false);
                        const next = createCustomCalculatorState(
                          undefined,
                          calculator.attempts.length,
                          minutes * 6_000,
                        );
                        next.perAttemptLimitCentiseconds =
                          calculator.perAttemptLimitCentiseconds;
                        requestReplacement(next);
                      }}
                      value={
                        isCustomLimit
                          ? "custom"
                          : String(calculator.limitCentiseconds / 6_000)
                      }
                    >
                      {calculatorLimitPresets.map((minutes) => (
                        <MenuItem key={minutes} value={minutes}>
                          {formatTime(minutes * 6_000)}
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">Custom limit</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                {isCustomLimit ? (
                  <Box>
                    <TimeSettingField
                      label="Custom cumulative limit"
                      onCommit={(limit) => {
                        if (limit !== null) {
                          updateLimits(limit, calculator.perAttemptLimitCentiseconds);
                        }
                      }}
                      value={calculator.limitCentiseconds}
                    />
                  </Box>
                ) : null}
                <Box>
                  <FormControl fullWidth>
                    <InputLabel id="attempt-count-label">Attempts</InputLabel>
                    <Select
                      label="Attempts"
                      labelId="attempt-count-label"
                      onChange={(event) => {
                        if (event.target.value === "custom") {
                          setCustomAttempts(true);
                          setCustomAttemptsDraft(String(calculator.attempts.length));
                          setCustomAttemptsError(false);
                          return;
                        }
                        setCustomAttempts(false);
                        const next = createCustomCalculatorState(
                          undefined,
                          Number(event.target.value),
                          calculator.limitCentiseconds,
                        );
                        next.perAttemptLimitCentiseconds =
                          calculator.perAttemptLimitCentiseconds;
                        requestReplacement(next);
                      }}
                      value={
                        customAttempts || ![1, 2, 3, 5].includes(calculator.attempts.length)
                          ? "custom"
                          : calculator.attempts.length
                      }
                    >
                      {[1, 2, 3, 5].map((count) => (
                        <MenuItem key={count} value={count}>
                          {count}
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">
                        Custom
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                {customAttempts || ![1, 2, 3, 5].includes(calculator.attempts.length) ? (
                  <Box>
                    <TextField
                      error={customAttemptsError}
                      fullWidth
                      helperText={customAttemptsError ? "Enter a whole number from 1 to 100." : "1–100 attempts"}
                      label="Custom attempts"
                      onBlur={commitCustomAttempts}
                      onChange={(event) => {
                        setCustomAttemptsDraft(event.target.value);
                        setCustomAttemptsError(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitCustomAttempts();
                        }
                      }}
                      slotProps={{ htmlInput: { inputMode: "numeric", min: 1, max: 100 } }}
                      type="number"
                      value={customAttemptsDraft}
                    />
                  </Box>
                ) : null}
              </>
            ) : null}

          </Stack>

          <Stack aria-live="polite" spacing={2}>
            <Stat
              caption={`${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} left`}
              emphasis
              label="Remaining"
              value={`${upperBound}${formatTime(Math.max(0, summary.remainingCentiseconds))}`}
            />
            <Stat
              caption={`of ${formatTime(calculator.limitCentiseconds)}`}
              label="Used"
              value={formatTime(summary.usedCentiseconds)}
            />
          </Stack>

          {summary.unknownCount > 0 ? (
            <Alert severity="warning">
              {summary.unknownCount} DNF{summary.unknownCount === 1 ? " is" : "s are"} missing
              elapsed time, so the remaining time is an upper bound.
            </Alert>
          ) : null}
          {summary.exhausted ? (
            <Alert severity="error">The cumulative limit is exhausted.</Alert>
          ) : null}
        </Stack>

        <Stack spacing={2}>
          <Stack spacing={1.5}>
            {orderedAttempts(calculator.attempts).map((attempt, index) => {
              const before = budgetBeforeAttempt(
                budget,
                attempt.roundId,
                attempt.attemptNumber,
              );
              return (
                <Box
                  data-attempt-key={`${attempt.roundId}:${attempt.attemptNumber}`}
                  key={`${attempt.roundId}:${attempt.attemptNumber}`}
                >
                  <AttemptInput
                    attempt={attempt}
                    capCentiseconds={Math.max(0, before.capForNextAttemptCentiseconds)}
                    label={`Attempt ${attempt.attemptNumber}`}
                    onCommit={updateAttempt}
                    onMove={(direction) => {
                      const fields = document.querySelectorAll<HTMLInputElement>(
                        "[data-attempt-key] input[type='tel']",
                      );
                      const offset = direction === "next" ? 1 : -1;
                      fields.item(index + offset)?.focus();
                    }}
                  />
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button
              disabled={!nextAttempt || summary.isUpperBound || summary.exhausted}
              onClick={() => {
                if (!nextAttempt) return;
                setPendingAction({
                  kind: "stop",
                  roundId: nextAttempt.roundId,
                  attemptNumber: nextAttempt.attemptNumber,
                  description: `Attempt ${nextAttempt.attemptNumber} will be recorded as DNF at exactly ${formatTime(summary.remainingCentiseconds)}${calculator.attempts.filter(({ outcome }) => outcome === "skipped").length > 1 ? ", and the other untaken attempts as DNS" : ""}.`,
                });
              }}
              variant="outlined"
            >
              Stopped at the limit
            </Button>
            <Button
              color="warning"
              disabled={!nextAttempt || enteredCount === 0}
              onClick={() => {
                if (!nextAttempt) return;
                const round = calculator.rounds.find(
                  ({ roundId }) => roundId === nextAttempt.roundId,
                );
                const count = calculator.attempts.filter(
                  (attempt) =>
                    attempt.roundId === nextAttempt.roundId && attempt.outcome === "skipped",
                ).length;
                setPendingAction({
                  kind: "dns",
                  roundId: nextAttempt.roundId,
                  description: `${count} remaining attempt${count === 1 ? "" : "s"} in ${round?.eventName ?? nextAttempt.roundId} will be marked DNS. Other rounds in this shared group will not be changed.`,
                });
              }}
              variant="outlined"
            >
              DNS the rest
            </Button>
          </Stack>
        </Stack>
      </Box>

      <ConfirmActionDialog
        confirmLabel={pendingAction ? dialogText[pendingAction.kind].confirm : ""}
        description={pendingAction?.description ?? ""}
        onCancel={() => setPendingAction(null)}
        onConfirm={runPendingAction}
        open={pendingAction !== null}
        title={pendingAction ? dialogText[pendingAction.kind].title : ""}
      />
    </Stack>
  );
}
