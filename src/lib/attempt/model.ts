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
  syncStatus?: "local" | "sending" | "synced" | "failed";
  syncError?: string;
  remoteResult?: number;
  changedRemotely?: boolean;
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

export function isTrackedAttempt(value: unknown): value is TrackedAttempt {
  if (typeof value !== "object" || value === null) return false;
  const attempt = value as Record<string, unknown>;
  if (
    typeof attempt.roundId !== "string" ||
    !Number.isInteger(attempt.attemptNumber) ||
    !["ok", "dnf", "dns", "skipped"].includes(String(attempt.outcome)) ||
    (attempt.centiseconds !== null && !Number.isSafeInteger(attempt.centiseconds)) ||
    typeof attempt.estimated !== "boolean" ||
    !Number.isInteger(attempt.order) ||
    typeof attempt.enteredAt !== "string" ||
    (attempt.auto !== undefined && typeof attempt.auto !== "boolean") ||
    (attempt.syncStatus !== undefined &&
      (typeof attempt.syncStatus !== "string" ||
        !["local", "sending", "synced", "failed"].includes(attempt.syncStatus))) ||
    (attempt.syncError !== undefined && typeof attempt.syncError !== "string") ||
    (attempt.remoteResult !== undefined && !Number.isInteger(attempt.remoteResult)) ||
    (attempt.changedRemotely !== undefined && typeof attempt.changedRemotely !== "boolean")
  ) {
    return false;
  }
  return validateAttempt(attempt as TrackedAttempt).length === 0;
}
