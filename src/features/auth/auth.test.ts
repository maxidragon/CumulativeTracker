import type { Competition } from "@wca/helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageKeys } from "../../lib/storage";
import {
  fetchCurrentUser,
  fetchManagedCompetitions,
  hasCompetitionPermissionHint,
} from "./api";
import { oauthStorageKeys } from "./consumeOAuthFragment";
import { loadAuthState } from "./model";
import { buildAuthorizationUrl, generateOAuthState } from "./oauth";

const session = {
  accessToken: "private-token",
  expiresAt: "2026-10-01T00:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe("OAuth session", () => {
  it("moves a verified redirect result into versioned local storage", () => {
    sessionStorage.setItem(
      oauthStorageKeys.result,
      JSON.stringify({ status: "success", ...session }),
    );
    expect(loadAuthState(Date.parse("2026-09-21T00:00:00.000Z"))).toEqual({
      session,
      error: null,
    });
    expect(sessionStorage.getItem(oauthStorageKeys.result)).toBeNull();
    expect(localStorage.getItem(storageKeys.session)).toContain("private-token");
  });

  it("clears an expired session", () => {
    localStorage.setItem(storageKeys.session, JSON.stringify(session));
    expect(loadAuthState(Date.parse("2026-10-02T00:00:00.000Z"))).toEqual({
      session: null,
      error: "Your WCA sign-in expired. Please sign in again.",
    });
    expect(localStorage.getItem(storageKeys.session)).toBeNull();
  });

  it("builds the implicit authorization request with the required scope", () => {
    const url = new URL(
      buildAuthorizationUrl({
        clientId: "public-client-id",
        redirectUri: "https://example.test/CumulativeTracker/",
        state: "nonce",
      }),
    );
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("scope")).toBe("public manage_competitions");
    expect(url.searchParams.get("state")).toBe("nonce");
  });

  it("generates an unpredictable 192-bit state value", () => {
    expect(generateOAuthState()).toMatch(/^[a-f0-9]{48}$/);
    expect(generateOAuthState()).not.toBe(generateOAuthState());
  });
});

describe("authenticated WCA API", () => {
  it("normalizes the current user and sends the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ me: { id: 42, name: "Example Manager", wca_id: "2000TEST01" } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCurrentUser(session)).resolves.toEqual({
      id: 42,
      name: "Example Manager",
      wcaId: "2000TEST01",
    });
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe("https://www.worldcubeassociation.org/api/v0/me");
    expect(request[1].headers).toMatchObject({ Authorization: "Bearer private-token" });
  });

  it("loads the competitions managed by the user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([{ id: "InventedOpen2026", name: "Invented Open 2026" }]),
          { status: 200 },
        ),
      ),
    );
    await expect(fetchManagedCompetitions(session)).resolves.toEqual([
      { id: "InventedOpen2026", name: "Invented Open 2026" },
    ]);
  });

  it("accepts either a WCIF role or the managed list as a permission hint", () => {
    const competition = {
      id: "InventedOpen2026",
      persons: [{ wcaUserId: 42, roles: ["organizer"] }],
    } as unknown as Competition;
    const user = { id: 42, name: "Example Manager", wcaId: null };
    expect(hasCompetitionPermissionHint(user, competition, [])).toBe(true);
    expect(
      hasCompetitionPermissionHint(
        { ...user, id: 99 },
        competition,
        [{ id: competition.id, name: "Invented Open 2026" }],
      ),
    ).toBe(true);
    expect(hasCompetitionPermissionHint({ ...user, id: 99 }, competition, [])).toBe(false);
  });
});
