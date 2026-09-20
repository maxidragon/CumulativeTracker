import { oauthStorageKeys } from "./consumeOAuthFragment";

const DEFAULT_WCA_ORIGIN = "https://www.worldcubeassociation.org";

function configuredString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

export function oauthClientId(): string {
  return configuredString(import.meta.env.VITE_WCA_OAUTH_CLIENT_ID);
}

export function buildAuthorizationUrl({
  clientId,
  redirectUri,
  state,
  origin = DEFAULT_WCA_ORIGIN,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  origin?: string;
}): string {
  const url = new URL("/oauth/authorize", origin);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "public manage_competitions");
  url.searchParams.set("state", state);
  return url.toString();
}

export function generateOAuthState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function beginWcaSignIn(): void {
  const clientId = oauthClientId();
  if (!clientId) throw new Error("WCA sign-in is not configured for this deployment.");

  const state = generateOAuthState();
  const returnRoute = window.location.hash.startsWith("#/") ? window.location.hash : "#/";
  sessionStorage.setItem(oauthStorageKeys.state, state);
  sessionStorage.setItem(oauthStorageKeys.returnRoute, returnRoute);

  const configuredOrigin = configuredString(import.meta.env.VITE_WCA_ORIGIN, DEFAULT_WCA_ORIGIN);
  const redirectUri = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  window.location.assign(
    buildAuthorizationUrl({ clientId, redirectUri, state, origin: configuredOrigin }),
  );
}
