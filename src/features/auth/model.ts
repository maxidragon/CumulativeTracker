import { readJson, removeStoredValue, storageKeys, writeJson } from "../../lib/storage";
import { oauthStorageKeys } from "./consumeOAuthFragment";

export type AuthSession = {
  accessToken: string;
  expiresAt: string;
};

type OAuthResult =
  | { status: "success"; accessToken: string; expiresAt: string }
  | { status: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAuthSession(value: unknown): value is AuthSession {
  return (
    isRecord(value) &&
    typeof value.accessToken === "string" &&
    value.accessToken !== "" &&
    typeof value.expiresAt === "string" &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
}

function isOAuthResult(value: unknown): value is OAuthResult {
  return (
    isRecord(value) &&
    ((value.status === "success" && isAuthSession(value)) ||
      (value.status === "error" && typeof value.message === "string"))
  );
}

export function loadAuthState(now = Date.now()): {
  session: AuthSession | null;
  error: string | null;
} {
  let oauthResult: OAuthResult | null = null;
  try {
    const rawResult = sessionStorage.getItem(oauthStorageKeys.result);
    const parsed: unknown = rawResult ? JSON.parse(rawResult) : null;
    if (isOAuthResult(parsed)) oauthResult = parsed;
    sessionStorage.removeItem(oauthStorageKeys.result);
  } catch {
    try {
      sessionStorage.removeItem(oauthStorageKeys.result);
    } catch {
      // Session storage may be disabled; continue with the persisted session.
    }
  }

  const redirectedSession: AuthSession | null =
    oauthResult?.status === "success"
      ? {
          accessToken: oauthResult.accessToken,
          expiresAt: oauthResult.expiresAt,
        }
      : null;
  if (redirectedSession) writeJson(storageKeys.session, redirectedSession);
  const stored = readJson(storageKeys.session, isAuthSession);
  const session = redirectedSession ?? stored;
  if (session && Date.parse(session.expiresAt) <= now) {
    removeStoredValue(storageKeys.session);
    return { session: null, error: "Your WCA sign-in expired. Please sign in again." };
  }
  return {
    session,
    error: oauthResult?.status === "error" ? oauthResult.message : null,
  };
}

export function storeAuthSession(session: AuthSession): void {
  writeJson(storageKeys.session, session);
}

export function clearAuthSession(): void {
  removeStoredValue(storageKeys.session);
}
