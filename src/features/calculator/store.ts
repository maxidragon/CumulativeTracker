import { create } from "zustand";
import type { TrackedAttempt } from "../../lib/attempt";
import { readJson, storageKeys, writeJson } from "../../lib/storage";
import {
  decodeCalculatorState,
  defaultCalculatorState,
  isCalculatorState,
  type CalculatorState,
} from "./model";

type CalculatorStore = {
  calculator: CalculatorState;
  resetCalculator: () => void;
  replaceCalculator: (calculator: CalculatorState) => void;
  updateAttempt: (attempt: TrackedAttempt) => void;
  updateLimits: (limit: number, perAttempt: number | null) => void;
};

function initialCalculator(): CalculatorState {
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  const fromUrl = decodeCalculatorState(new URLSearchParams(hashQuery).get("state"));
  return (
    fromUrl ??
    readJson(storageKeys.calculator, isCalculatorState) ??
    defaultCalculatorState
  );
}

function persist(calculator: CalculatorState): CalculatorState {
  writeJson(storageKeys.calculator, calculator);
  return calculator;
}

export const useCalculatorStore = create<CalculatorStore>((set) => ({
  calculator: initialCalculator(),
  resetCalculator: () => set({ calculator: defaultCalculatorState }),
  replaceCalculator: (calculator) => set({ calculator: persist(calculator) }),
  updateAttempt: (attempt) =>
    set(({ calculator }) => ({
      calculator: persist({
        ...calculator,
        attempts: calculator.attempts.map((current) =>
          current.roundId === attempt.roundId &&
          current.attemptNumber === attempt.attemptNumber
            ? attempt
            : current,
        ),
      }),
    })),
  updateLimits: (limitCentiseconds, perAttemptLimitCentiseconds) =>
    set(({ calculator }) => ({
      calculator: persist({
        ...calculator,
        presetId: null,
        limitCentiseconds,
        perAttemptLimitCentiseconds,
      }),
    })),
}));
