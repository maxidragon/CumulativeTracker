import { create } from "zustand";
import type { TrackedAttempt } from "../../lib/attempt";
import { removeStoredValue, storageKeys } from "../../lib/storage";
import { defaultCalculatorState, type CalculatorState } from "./model";

type CalculatorStore = {
  calculator: CalculatorState;
  resetCalculator: () => void;
  replaceCalculator: (calculator: CalculatorState) => void;
  updateAttempt: (attempt: TrackedAttempt) => void;
  updateLimits: (limit: number, perAttempt: number | null) => void;
};

// Calculations are scratch work: kept in memory only. Earlier versions saved them, so drop
// whatever an older visit left behind.
removeStoredValue(storageKeys.calculator);

export const useCalculatorStore = create<CalculatorStore>((set) => ({
  calculator: defaultCalculatorState,
  resetCalculator: () => set({ calculator: defaultCalculatorState }),
  replaceCalculator: (calculator) => set({ calculator }),
  updateAttempt: (attempt) =>
    set(({ calculator }) => ({
      calculator: {
        ...calculator,
        attempts: calculator.attempts.map((current) =>
          current.roundId === attempt.roundId &&
          current.attemptNumber === attempt.attemptNumber
            ? attempt
            : current,
        ),
      },
    })),
  updateLimits: (limitCentiseconds, perAttemptLimitCentiseconds) =>
    set(({ calculator }) => ({
      calculator: {
        ...calculator,
        presetId: null,
        limitCentiseconds,
        perAttemptLimitCentiseconds,
      },
    })),
}));
