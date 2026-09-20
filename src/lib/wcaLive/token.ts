import { readJson, removeStoredValue, storageKeys, writeJson } from "../storage";

export const SCORETAKING_TOKEN_VALIDITY_MS = 7 * 24 * 60 * 60 * 1_000;

export type ScoretakingToken = {
  token: string;
  enteredAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isScoretakingToken(value: unknown): value is ScoretakingToken {
  return (
    isRecord(value) &&
    typeof value.token === "string" &&
    value.token.length >= 4 &&
    typeof value.enteredAt === "string" &&
    Number.isFinite(Date.parse(value.enteredAt))
  );
}

export function readScoretakingToken(competitionId: string): ScoretakingToken | null {
  return readJson(storageKeys.token(competitionId), isScoretakingToken);
}

export function saveScoretakingToken(
  competitionId: string,
  token: string,
  enteredAt = new Date().toISOString(),
): ScoretakingToken {
  const value = { token: token.trim(), enteredAt };
  if (!isScoretakingToken(value)) throw new Error("Enter a valid WCA Live scoretaking token.");
  writeJson(storageKeys.token(competitionId), value);
  return value;
}

export function forgetScoretakingToken(competitionId: string): void {
  removeStoredValue(storageKeys.token(competitionId));
}

export function isScoretakingTokenExpired(
  token: ScoretakingToken,
  now = Date.now(),
): boolean {
  return now - Date.parse(token.enteredAt) >= SCORETAKING_TOKEN_VALIDITY_MS;
}

export function maskScoretakingToken(token: string): string {
  return `••••${token.slice(-4)}`;
}
