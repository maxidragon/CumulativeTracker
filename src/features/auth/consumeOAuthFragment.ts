const OAUTH_RETURN_ROUTE_KEY = "ct:oauth:return-route";
const OAUTH_STATE_KEY = "ct:oauth:state";
const OAUTH_RESULT_KEY = "ct:oauth:result";

type OAuthResult =
  | { status: "success"; accessToken: string; expiresAt: string }
  | { status: "error"; message: string };

export function consumeOAuthFragment(): void {
  const fragment = window.location.hash.slice(1);
  const params = new URLSearchParams(fragment);
  const isOAuthResponse = params.has("access_token") || params.has("error");

  if (!isOAuthResponse) return;

  const returnRoute = sessionStorage.getItem(OAUTH_RETURN_ROUTE_KEY) ?? "#/";
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  const actualState = params.get("state");
  let result: OAuthResult;

  if (!expectedState || actualState !== expectedState) {
    result = {
      status: "error",
      message: "WCA sign-in could not be verified. Please try again.",
    };
  } else if (params.has("error")) {
    result = {
      status: "error",
      message: params.get("error_description") ?? "WCA sign-in was cancelled.",
    };
  } else {
    const accessToken = params.get("access_token");
    const expiresIn = Number(params.get("expires_in"));

    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      result = { status: "error", message: "WCA returned an invalid sign-in response." };
    } else {
      result = {
        status: "success",
        accessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
      };
    }
  }

  sessionStorage.setItem(OAUTH_RESULT_KEY, JSON.stringify(result));
  sessionStorage.removeItem(OAUTH_RETURN_ROUTE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}${returnRoute}`);
}

export const oauthStorageKeys = {
  result: OAUTH_RESULT_KEY,
  returnRoute: OAUTH_RETURN_ROUTE_KEY,
  state: OAUTH_STATE_KEY,
} as const;
