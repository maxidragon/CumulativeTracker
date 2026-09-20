export const DNF_VALUE = -1;
export const DNS_VALUE = -2;
export const SKIPPED_VALUE = 0;

export type Outcome = "ok" | "dnf" | "dns" | "skipped";

export type TrackedAttempt = {
  roundId: string;
  attemptNumber: number;
  outcome: Outcome;
  centiseconds: number | null;
  estimated: boolean;
  order: number;
  enteredAt: string;
  auto?: boolean;
};

export function officialResult(attempt: TrackedAttempt): number {
  switch (attempt.outcome) {
    case "ok":
      if (attempt.centiseconds === null) {
        throw new Error("A successful attempt must have a recorded time.");
      }
      return attempt.centiseconds;
    case "dnf":
      return DNF_VALUE;
    case "dns":
      return DNS_VALUE;
    case "skipped":
      return SKIPPED_VALUE;
  }
}

export function countedTime(attempt: TrackedAttempt): number | null {
  switch (attempt.outcome) {
    case "ok":
      if (attempt.centiseconds === null) {
        throw new Error("A successful attempt must have a recorded time.");
      }
      return attempt.centiseconds;
    case "dnf":
      return attempt.centiseconds;
    case "dns":
    case "skipped":
      return 0;
  }
}

export function isEnteredAttempt(attempt: TrackedAttempt): boolean {
  return attempt.outcome !== "skipped";
}

export function validateAttempt(attempt: TrackedAttempt): string[] {
  const errors: string[] = [];
  if (attempt.roundId.trim() === "") errors.push("Round id is required.");
  if (!Number.isInteger(attempt.attemptNumber) || attempt.attemptNumber < 1) {
    errors.push("Attempt number must be a positive integer.");
  }
  if (
    attempt.centiseconds !== null &&
    (!Number.isSafeInteger(attempt.centiseconds) || attempt.centiseconds < 0)
  ) {
    errors.push("Time must be a non-negative integer number of centiseconds.");
  }
  if (attempt.outcome === "ok" && attempt.centiseconds === null) {
    errors.push("A successful attempt must have a recorded time.");
  }
  if (
    (attempt.outcome === "dns" || attempt.outcome === "skipped") &&
    attempt.centiseconds !== null
  ) {
    errors.push("A DNS or skipped attempt cannot have an elapsed time.");
  }
  if (attempt.estimated && attempt.centiseconds === null) {
    errors.push("An estimate must have a recorded time.");
  }
  return errors;
}
