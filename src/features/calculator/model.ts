import { attemptsForFormat, groupKey, type RoundFormat } from "../../lib/cumulative";
import { isTrackedAttempt, type TrackedAttempt } from "../../lib/attempt";

export type CalculatorRound = {
  roundId: string;
  eventId: string;
  eventName: string;
  format: RoundFormat;
};

export type CalculatorState = {
  version: 1;
  presetId: string | null;
  rounds: CalculatorRound[];
  limitCentiseconds: number;
  perAttemptLimitCentiseconds: number | null;
  attempts: TrackedAttempt[];
};

export type CalculatorPreset = {
  id: string;
  label: string;
  limitCentiseconds: number;
  rounds: CalculatorRound[];
};

export const calculatorLimitPresets = [10, 12, 15, 20, 60, 90, 120] as const;

export const timedEvents = [
  ["333", "3×3×3 Cube"],
  ["222", "2×2×2 Cube"],
  ["444", "4×4×4 Cube"],
  ["555", "5×5×5 Cube"],
  ["666", "6×6×6 Cube"],
  ["777", "7×7×7 Cube"],
  ["333bf", "3×3×3 Blindfolded"],
  ["333oh", "3×3×3 One-Handed"],
  ["clock", "Clock"],
  ["minx", "Megaminx"],
  ["pyram", "Pyraminx"],
  ["skewb", "Skewb"],
  ["sq1", "Square-1"],
  ["444bf", "4×4×4 Blindfolded"],
  ["555bf", "5×5×5 Blindfolded"],
] as const;

export const calculatorPresets: CalculatorPreset[] = [
  {
    id: "333bf-bo3-20",
    label: "3BLD · best of 3 · 20:00 cumulative",
    limitCentiseconds: 120_000,
    rounds: [
      { roundId: "333bf-r1", eventId: "333bf", eventName: "3BLD", format: "3" },
    ],
  },
  {
    id: "333bf-mo3-30",
    label: "3BLD · mean of 3 · 30:00 cumulative",
    limitCentiseconds: 180_000,
    rounds: [
      { roundId: "333bf-r1", eventId: "333bf", eventName: "3BLD", format: "m" },
    ],
  },
  {
    id: "444bf-bo3-60",
    label: "4BLD · best of 3 · 60:00 cumulative",
    limitCentiseconds: 360_000,
    rounds: [
      { roundId: "444bf-r1", eventId: "444bf", eventName: "4BLD", format: "3" },
    ],
  },
  {
    id: "555bf-bo3-60",
    label: "5BLD · best of 3 · 60:00 cumulative",
    limitCentiseconds: 360_000,
    rounds: [
      { roundId: "555bf-r1", eventId: "555bf", eventName: "5BLD", format: "3" },
    ],
  },
  {
    id: "444bf-555bf-shared-60",
    label: "4BLD + 5BLD · 60:00 shared",
    limitCentiseconds: 360_000,
    rounds: [
      { roundId: "444bf-r1", eventId: "444bf", eventName: "4BLD", format: "3" },
      { roundId: "555bf-r1", eventId: "555bf", eventName: "5BLD", format: "3" },
    ],
  },
];

function createAttempts(
  rounds: CalculatorRound[],
  customAttemptCount?: number,
): TrackedAttempt[] {
  let order = 0;
  return rounds.flatMap((round) =>
    Array.from(
      {
        length: customAttemptCount ?? attemptsForFormat(round.format),
      },
      (_, index) => ({
      roundId: round.roundId,
      attemptNumber: index + 1,
      outcome: "skipped" as const,
      centiseconds: null,
      estimated: false,
      order: ++order,
      enteredAt: "",
      }),
    ),
  );
}

export function stateFromPreset(preset: CalculatorPreset): CalculatorState {
  return {
    version: 1,
    presetId: preset.id,
    rounds: preset.rounds,
    limitCentiseconds: preset.limitCentiseconds,
    perAttemptLimitCentiseconds: null,
    attempts: createAttempts(preset.rounds),
  };
}

export function createCustomCalculatorState(
  eventId = "333bf",
  attemptCount = 3,
  limitCentiseconds = 120_000,
): CalculatorState {
  const eventName = timedEvents.find(([id]) => id === eventId)?.[1] ?? eventId;
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1 || attemptCount > 100) {
    throw new Error("A calculator can have between 1 and 100 attempts.");
  }
  const customFormat = ![1, 2, 3, 5].includes(attemptCount);
  const format: RoundFormat = customFormat
    ? "a"
    : String(attemptCount) as RoundFormat;
  const rounds = [{ roundId: `${eventId}-r1`, eventId, eventName, format }];
  return {
    version: 1,
    presetId: null,
    rounds,
    limitCentiseconds,
    perAttemptLimitCentiseconds: null,
    attempts: createAttempts(rounds, customFormat ? attemptCount : undefined),
  };
}

/** Empties every attempt and keeps the setup: limit, per-attempt limit, rounds, attempt count. */
export function clearCalculatorAttempts(state: CalculatorState): CalculatorState {
  const customAttemptCount =
    state.rounds[0]?.format === "a" ? state.attempts.length : undefined;
  return { ...state, attempts: createAttempts(state.rounds, customAttemptCount) };
}

const defaultPreset = calculatorPresets[0];
if (!defaultPreset) throw new Error("At least one calculator preset is required.");
export const defaultCalculatorState = stateFromPreset(defaultPreset);

export function calculatorGroupKey(state: CalculatorState): string {
  return groupKey(state.rounds.map(({ roundId }) => roundId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCalculatorState(value: unknown): value is CalculatorState {
  if (!isRecord(value) || value.version !== 1) return false;
  if (
    !Number.isSafeInteger(value.limitCentiseconds) ||
    (value.limitCentiseconds as number) <= 0 ||
    !Array.isArray(value.rounds) ||
    value.rounds.length === 0 ||
    !Array.isArray(value.attempts)
  ) {
    return false;
  }
  if (
    value.perAttemptLimitCentiseconds !== null &&
    (!Number.isSafeInteger(value.perAttemptLimitCentiseconds) ||
      (value.perAttemptLimitCentiseconds as number) <= 0)
  ) {
    return false;
  }
  if (value.presetId !== null && typeof value.presetId !== "string") return false;

  const roundsValid = value.rounds.every(
    (round) =>
      isRecord(round) &&
      typeof round.roundId === "string" &&
      typeof round.eventId === "string" &&
      typeof round.eventName === "string" &&
      ["1", "2", "3", "5", "a", "m"].includes(String(round.format)),
  );
  const roundIds = new Set(
    value.rounds
      .filter(isRecord)
      .map((round) => round.roundId)
      .filter((roundId): roundId is string => typeof roundId === "string"),
  );
  const attemptsValid = value.attempts.every(
    (attempt) =>
      isTrackedAttempt(attempt) &&
      roundIds.has(attempt.roundId) &&
      attempt.order >= 1,
  );
  if (!roundsValid || !attemptsValid) return false;

  const attemptKeys = value.attempts.map(
    (attempt) => `${String((attempt as Record<string, unknown>).roundId)}:${String((attempt as Record<string, unknown>).attemptNumber)}`,
  );
  const orders = value.attempts.map(
    (attempt) => (attempt as Record<string, unknown>).order,
  );
  return (
    new Set(attemptKeys).size === attemptKeys.length &&
    new Set(orders).size === orders.length
  );
}

export function encodeCalculatorState(state: CalculatorState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeCalculatorState(encoded: string | null): CalculatorState | null {
  if (!encoded) return null;
  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isCalculatorState(value) ? value : null;
  } catch {
    return null;
  }
}
