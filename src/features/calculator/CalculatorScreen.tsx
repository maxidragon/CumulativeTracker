import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmActionDialog } from "../../components/ConfirmActionDialog";
import { formatTime } from "../../lib/attempt";
import {
  attemptsLeft,
  averageForRemainingAttempts,
  budgetBeforeAttempt,
  deriveBudget,
  dnsRemainingInRound,
  orderedAttempts,
  perAttemptLimitWarning,
  stopAttemptAtLimit,
  type Budget,
} from "../../lib/cumulative";
import { AttemptInput } from "../entry/AttemptInput";
import {
  calculatorLimitPresets,
  createCustomCalculatorState,
  encodeCalculatorState,
  type CalculatorState,
} from "./model";
import { useCalculatorStore } from "./store";
import { TimeSettingField } from "./TimeSettingField";

type PendingAction =
  | { kind: "replace"; state: CalculatorState; description: string }
  | { kind: "stop"; roundId: string; attemptNumber: number; description: string }
  | { kind: "dns"; roundId: string; description: string };

export function CalculatorScreen() {
  const calculator = useCalculatorStore((state) => state.calculator);
  const replaceCalculator = useCalculatorStore((state) => state.replaceCalculator);
  const updateAttempt = useCalculatorStore((state) => state.updateAttempt);
  const updateLimits = useCalculatorStore((state) => state.updateLimits);
  const [, setSearchParams] = useSearchParams();
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

  useEffect(() => {
    setSearchParams({ state: encodeCalculatorState(calculator) }, { replace: true });
  }, [calculator, setSearchParams]);

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
  const average = averageForRemainingAttempts(summary, remainingAttempts);
  const nextAttempt = orderedAttempts(calculator.attempts).find(
    ({ outcome }) => outcome === "skipped",
  );
  const enteredCount = calculator.attempts.filter(
    ({ outcome }) => outcome !== "skipped",
  ).length;
  const limitWarning = perAttemptLimitWarning(budget);

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

  return (
    <Stack spacing={5}>
      <Box>
        <Chip color="secondary" label="No login · stays on this device" size="small" />
        <Typography component="h1" sx={{ mt: 2 }} variant="h2">
          Cumulative limit calculator
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 18, mt: 1 }}>
          Enter the final result shown on the scorecard. For a DNF, keep its elapsed
          time and tick DNF beside it.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2}>
            {customRound ? (
              <>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <FormControl fullWidth>
                    <InputLabel id="limit-preset-label">Common cumulative limit</InputLabel>
                    <Select
                      label="Common cumulative limit"
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
                          {minutes}:00
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">Custom limit</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
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
                </Grid>
                {customAttempts || ![1, 2, 3, 5].includes(calculator.attempts.length) ? (
                  <Grid size={{ xs: 12, sm: 4 }}>
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
                  </Grid>
                ) : null}
              </>
            ) : null}

            {isCustomLimit ? (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TimeSettingField
                  label="Custom cumulative limit"
                  onCommit={(limit) => {
                    if (limit !== null) {
                      updateLimits(limit, calculator.perAttemptLimitCentiseconds);
                    }
                  }}
                  value={calculator.limitCentiseconds}
                />
              </Grid>
            ) : null}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TimeSettingField
                label="Per-attempt limit"
                onCommit={(perAttempt) =>
                  updateLimits(calculator.limitCentiseconds, perAttempt)
                }
                optional
                value={calculator.perAttemptLimitCentiseconds}
              />
            </Grid>
          </Grid>
          {limitWarning ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {limitWarning}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Grid aria-live="polite" container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: "100%" }} variant="outlined">
            <CardContent>
              <Typography color="text.secondary" variant="overline">
                Remaining
              </Typography>
              <Typography
                component="p"
                sx={{ fontVariantNumeric: "tabular-nums" }}
                variant="h3"
              >
                {summary.isUpperBound ? "≤ " : ""}
                {formatTime(Math.max(0, summary.remainingCentiseconds), {
                  compact: true,
                })}
              </Typography>
              <Typography color="text.secondary">
                used {formatTime(summary.usedCentiseconds, { compact: true })} of{" "}
                {formatTime(calculator.limitCentiseconds, { compact: true })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: "100%" }} variant="outlined">
            <CardContent>
              <Typography color="text.secondary" variant="overline">
                Next attempt cap
              </Typography>
              <Typography
                component="p"
                sx={{ fontVariantNumeric: "tabular-nums" }}
                variant="h3"
              >
                {summary.isUpperBound ? "≤ " : ""}
                {formatTime(Math.max(0, summary.capForNextAttemptCentiseconds), {
                  compact: true,
                })}
              </Typography>
              <Typography color="text.secondary">
                {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} left
                {average !== null && remainingAttempts > 1
                  ? ` · avg ${formatTime(average, { compact: true })} each`
                  : ""}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {summary.unknownCount > 0 ? (
        <Alert severity="warning">
          {summary.unknownCount} DNF{summary.unknownCount === 1 ? " is" : "s are"} missing
          elapsed time. Remaining and cap are upper bounds.
        </Alert>
      ) : null}
      {summary.exhausted ? (
        <Alert severity="error">The cumulative limit is exhausted.</Alert>
      ) : null}

      <Stack divider={<Divider flexItem />} spacing={3}>
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

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          disabled={!nextAttempt || summary.isUpperBound || summary.exhausted}
          onClick={() => {
            if (!nextAttempt) return;
            setPendingAction({
              kind: "stop",
              roundId: nextAttempt.roundId,
              attemptNumber: nextAttempt.attemptNumber,
              description: `Attempt ${nextAttempt.attemptNumber} will be recorded as DNF at exactly ${formatTime(summary.remainingCentiseconds, { compact: true })}.`,
            });
          }}
          variant="contained"
        >
          Stopped at the limit
        </Button>
        <Button
          color="warning"
          disabled={!nextAttempt || !summary.exhausted}
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

      <ConfirmActionDialog
        confirmLabel={
          pendingAction?.kind === "replace"
            ? "Clear and change"
            : pendingAction?.kind === "stop"
              ? "Record DNF"
              : "Mark DNS"
        }
        description={pendingAction?.description ?? ""}
        onCancel={() => setPendingAction(null)}
        onConfirm={runPendingAction}
        open={pendingAction !== null}
        title={
          pendingAction?.kind === "replace"
            ? "Change calculator setup?"
            : pendingAction?.kind === "stop"
              ? "Stop this attempt at the limit?"
              : "DNS the remaining attempts?"
        }
      />
    </Stack>
  );
}
