const CENTISECONDS_PER_SECOND = 100;
const CENTISECONDS_PER_MINUTE = 60 * CENTISECONDS_PER_SECOND;
const CENTISECONDS_PER_HOUR = 60 * CENTISECONDS_PER_MINUTE;
export const TEN_MINUTES_CENTISECONDS = 10 * CENTISECONDS_PER_MINUTE;

function assertCentiseconds(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Expected a non-negative integer number of centiseconds, got ${value}.`);
  }
}

const MAX_TIME_DIGITS = 8;

/**
 * WCA Live's typed-time rule: digits fill `hh:mm:ss.cc` from the right, so `25000` is
 * 2:50.00, not 25000 centiseconds. A slot may overflow (`9999` is 99.99s), as in WCA Live.
 */
function centisecondsFromDigits(digits: string): number {
  const padded = digits.padStart(MAX_TIME_DIGITS, "0");
  const [hours, minutes, seconds, hundredths] = [0, 2, 4, 6].map((start) =>
    Number(padded.slice(start, start + 2)),
  );
  return (
    (hours ?? 0) * CENTISECONDS_PER_HOUR +
    (minutes ?? 0) * CENTISECONDS_PER_MINUTE +
    (seconds ?? 0) * CENTISECONDS_PER_SECOND +
    (hundredths ?? 0)
  );
}

export function parseTimeInput(input: string): number | null {
  const value = input.trim();
  if (value === "") return null;

  if (/^\d+$/.test(value)) {
    return value.length > MAX_TIME_DIGITS ? null : centisecondsFromDigits(value);
  }

  const match = value.match(/^(\d+(?::\d{1,2}){0,2})(?:\.(\d{2}))?$/);
  if (!match) return null;

  const [, clockText, hundredthsText] = match;
  if (clockText === undefined) return null;
  const clockParts = clockText.split(":").map(Number);
  const seconds = clockParts.at(-1) ?? 0;
  const minutes = clockParts.length >= 2 ? (clockParts.at(-2) ?? 0) : 0;
  const hours = clockParts.length === 3 ? (clockParts[0] ?? 0) : 0;
  const hundredths = Number(hundredthsText ?? 0);
  if (seconds >= 60 || (clockParts.length === 3 && minutes >= 60)) return null;

  const centiseconds =
    hours * CENTISECONDS_PER_HOUR +
    minutes * CENTISECONDS_PER_MINUTE +
    seconds * CENTISECONDS_PER_SECOND +
    hundredths;
  return Number.isSafeInteger(centiseconds) ? centiseconds : null;
}

export function autocompleteTime(centiseconds: number): number {
  assertCentiseconds(centiseconds);
  return centiseconds >= TEN_MINUTES_CENTISECONDS
    ? Math.floor(centiseconds / CENTISECONDS_PER_SECOND) * CENTISECONDS_PER_SECOND
    : centiseconds;
}

type FormatTimeOptions = {
  compact?: boolean;
  preserveCentiseconds?: boolean;
};

export function formatTime(
  centiseconds: number,
  { compact = false, preserveCentiseconds = false }: FormatTimeOptions = {},
): string {
  assertCentiseconds(centiseconds);

  const hours = Math.floor(centiseconds / CENTISECONDS_PER_HOUR);
  const minutes = Math.floor(
    (centiseconds % CENTISECONDS_PER_HOUR) / CENTISECONDS_PER_MINUTE,
  );
  const seconds = Math.floor(
    (centiseconds % CENTISECONDS_PER_MINUTE) / CENTISECONDS_PER_SECOND,
  );
  const hundredths = centiseconds % CENTISECONDS_PER_SECOND;
  const clock =
    hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      : minutes > 0
        ? `${minutes}:${seconds.toString().padStart(2, "0")}`
        : seconds.toString();

  if (
    !preserveCentiseconds &&
    compact &&
    hundredths === 0
  ) {
    return clock;
  }

  return `${clock}.${hundredths.toString().padStart(2, "0")}`;
}

/** Shows typed digits the way WCA Live does while typing: `25000` reads `2:50.00`. */
export function formatTimeInput(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_TIME_DIGITS);
  if (digits === "") return "";
  const padded = digits.padStart(MAX_TIME_DIGITS, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}.${padded.slice(6)}`.replace(
    /^[0:]*(?!\.)/,
    "",
  );
}

/** Reads an attempt field as typed, including overflowing slots like `99.99`. */
export function parseTimeDraft(draft: string): number | null {
  const digits = draft.replace(/\D/g, "");
  return digits === "" ? null : parseTimeInput(digits);
}
