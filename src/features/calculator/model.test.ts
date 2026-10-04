import { describe, expect, it } from "vitest";
import {
  calculatorPresets,
  calculatorLimitPresets,
  clearCalculatorAttempts,
  createCustomCalculatorState,
  defaultCalculatorState,
  stateFromPreset,
} from "./model";

describe("calculator state", () => {
  it("clears attempts without changing a custom count or a multi-event setup", () => {
    const custom = createCustomCalculatorState("333bf", 7, 90_000);
    const shared = calculatorPresets.find(({ rounds }) => rounds.length > 1);
    if (!shared) throw new Error("Expected a multi-event preset.");
    for (const state of [custom, stateFromPreset(shared)]) {
      const entered = {
        ...state,
        attempts: state.attempts.map((attempt) => ({
          ...attempt,
          outcome: "ok" as const,
          centiseconds: 3_000,
        })),
      };
      expect(clearCalculatorAttempts(entered)).toEqual(state);
    }
  });



  it("creates all attempts for a multi-event preset", () => {
    const preset = calculatorPresets.find(({ id }) => id.includes("shared"));
    if (!preset) throw new Error("Shared preset is missing.");
    expect(stateFromPreset(preset).attempts).toHaveLength(6);
  });

  it("offers common cumulative-limit choices in minutes", () => {
    expect(calculatorLimitPresets).toEqual([10, 12, 15, 20, 60, 90, 120]);
    expect(createCustomCalculatorState(undefined, 3, 60 * 6_000).limitCentiseconds).toBe(
      360_000,
    );
  });

  it("starts with five attempts under a 20:00 limit", () => {
    expect(defaultCalculatorState.attempts).toHaveLength(5);
    expect(defaultCalculatorState.limitCentiseconds).toBe(120_000);
  });

  it("supports a custom number of attempts", () => {
    const custom = createCustomCalculatorState(undefined, 12, 120_000);
    expect(custom.attempts).toHaveLength(12);
    expect(custom.rounds[0]?.format).toBe("a");
  });

});
