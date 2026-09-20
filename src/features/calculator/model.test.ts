import { afterEach, describe, expect, it } from "vitest";
import { readJson, storageKeys, writeJson } from "../../lib/storage";
import {
  calculatorPresets,
  decodeCalculatorState,
  defaultCalculatorState,
  encodeCalculatorState,
  isCalculatorState,
  createCustomCalculatorState,
  stateFromPreset,
} from "./model";

afterEach(() => localStorage.clear());

describe("calculator state", () => {
  it("round-trips shareable URL state", () => {
    const encoded = encodeCalculatorState(defaultCalculatorState);
    expect(decodeCalculatorState(encoded)).toEqual(defaultCalculatorState);
  });

  it("round-trips Unicode event names", () => {
    const custom = createCustomCalculatorState("333", 5);
    expect(custom.rounds[0]?.eventName).toContain("×");
    expect(decodeCalculatorState(encodeCalculatorState(custom))).toEqual(custom);
  });

  it("rejects malformed and unsupported state", () => {
    expect(decodeCalculatorState("not-base64")).toBeNull();
    expect(isCalculatorState({ ...defaultCalculatorState, version: 2 })).toBe(false);
  });

  it("creates all attempts for a multi-event preset", () => {
    const preset = calculatorPresets.find(({ id }) => id.includes("shared"));
    if (!preset) throw new Error("Shared preset is missing.");
    expect(stateFromPreset(preset).attempts).toHaveLength(6);
  });

  it("drops invalid local storage instead of crashing", () => {
    localStorage.setItem(storageKeys.calculator, "not json");
    expect(readJson(storageKeys.calculator, isCalculatorState)).toBeNull();
    expect(localStorage.getItem(storageKeys.calculator)).toBeNull();
  });

  it("reads valid state through the storage boundary", () => {
    writeJson(storageKeys.calculator, defaultCalculatorState);
    expect(readJson(storageKeys.calculator, isCalculatorState)).toEqual(
      defaultCalculatorState,
    );
  });
});
