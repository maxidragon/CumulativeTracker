import { afterEach, describe, expect, it } from "vitest";
import { consumeOAuthFragment, oauthStorageKeys } from "./consumeOAuthFragment";

describe("consumeOAuthFragment", () => {
  afterEach(() => {
    sessionStorage.clear();
    history.replaceState(null, "", "/");
  });

  it("leaves normal hash routes untouched", () => {
    history.replaceState(null, "", "/#/calculator");

    consumeOAuthFragment();

    expect(window.location.hash).toBe("#/calculator");
  });

  it("consumes a valid token before restoring the router fragment", () => {
    sessionStorage.setItem(oauthStorageKeys.state, "expected-state");
    sessionStorage.setItem(oauthStorageKeys.returnRoute, "#/calculator?limit=120000");
    history.replaceState(
      null,
      "",
      "/#access_token=secret&state=expected-state&expires_in=3600",
    );

    consumeOAuthFragment();

    expect(window.location.hash).toBe("#/calculator?limit=120000");
    expect(JSON.parse(sessionStorage.getItem(oauthStorageKeys.result) ?? "null")).toMatchObject({
      status: "success",
      accessToken: "secret",
    });
  });

  it("rejects a state mismatch and never retains the token", () => {
    sessionStorage.setItem(oauthStorageKeys.state, "expected-state");
    history.replaceState(null, "", "/#access_token=secret&state=wrong&expires_in=3600");

    consumeOAuthFragment();

    expect(sessionStorage.getItem(oauthStorageKeys.result)).not.toContain("secret");
    expect(window.location.hash).toBe("#/");
  });
});
