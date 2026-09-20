import type { TrackedAttempt } from "../attempt";

export type Budget = {
  groupKey: string;
  limitCentiseconds: number;
  perAttemptLimitCentiseconds: number | null;
  registrantId: number;
  attempts: TrackedAttempt[];
};

export type BudgetSummary = {
  usedCentiseconds: number;
  unknownCount: number;
  remainingCentiseconds: number;
  capForNextAttemptCentiseconds: number;
  exhausted: boolean;
  isUpperBound: boolean;
};

export type RoundFormat = "1" | "2" | "3" | "5" | "a" | "m";

export type Cutoff = {
  numberOfAttempts: number;
  attemptResult: number;
};

export type RoundPlan = {
  roundId: string;
  eventId: string;
  format: RoundFormat;
  cutoff: Cutoff | null;
  registered: boolean;
};
