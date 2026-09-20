import { describe, expect, it } from "vitest";
import {
  DNF_VALUE,
  DNS_VALUE,
  SKIPPED_VALUE,
  autocompleteTime,
  countedTime,
  formatTime,
  formatTimeInput,
  officialResult,
  parseTimeInput,
  type Outcome,
  type TrackedAttempt,
  validateAttempt,
} from ".";

function attempt(outcome: Outcome, centiseconds: number | null): TrackedAttempt {
  return {
    roundId: "333bf-r1",
    attemptNumber: 1,
    outcome,
    centiseconds,
    estimated: false,
    order: 1,
    enteredAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("attempt result encoding", () => {
  it.each([
    ["ok", 6_421, 6_421, 6_421],
    ["dnf", 60_000, DNF_VALUE, 60_000],
    ["dnf", null, DNF_VALUE, null],
    ["dns", null, DNS_VALUE, 0],
    ["skipped", null, SKIPPED_VALUE, 0],
  ] as const)("encodes %s", (outcome, time, official, counted) => {
    const value = attempt(outcome, time);
    expect(officialResult(value)).toBe(official);
    expect(countedTime(value)).toBe(counted);
  });

  it("rejects a successful attempt without a time", () => {
    expect(() => officialResult(attempt("ok", null))).toThrow(/recorded time/i);
    expect(() => countedTime(attempt("ok", null))).toThrow(/recorded time/i);
  });

  it("validates impossible persisted attempt shapes", () => {
    expect(validateAttempt(attempt("ok", null))).toContain(
      "A successful attempt must have a recorded time.",
    );
    expect(validateAttempt(attempt("dns", 100))).toContain(
      "A DNS or skipped attempt cannot have an elapsed time.",
    );
  });
});

describe("WCA time input", () => {
  it("fills digits right to left and normalizes the clock", () => {
    expect(formatTimeInput("12345")).toBe("2:03.45");
    expect(parseTimeInput("2:03.45")).toBe(12_345);
  });

  it("formats minutes and hours", () => {
    expect(formatTime(6_421)).toBe("1:04.21");
    expect(formatTime(372_345, { preserveCentiseconds: true })).toBe("1:02:03.45");
    expect(formatTime(120_000, { compact: true })).toBe("20:00");
  });

  it("truncates attempts of ten minutes or more to whole seconds", () => {
    expect(autocompleteTime(60_047)).toBe(60_000);
    expect(autocompleteTime(59_999)).toBe(59_999);
  });

  it("round-trips canonical input below ten minutes", () => {
    const value = 12_345;
    expect(parseTimeInput(formatTime(value))).toBe(value);
  });

  it("treats empty and non-numeric input as empty", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("hello")).toBeNull();
  });
});
