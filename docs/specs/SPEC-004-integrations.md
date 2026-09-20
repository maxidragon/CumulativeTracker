# SPEC-004 — Integrations

Everything here was verified against the live services and against
[`thewca/wca-live`](https://github.com/thewca/wca-live) at the time of writing. Re-verify before
changing any of it.

## Why there is no backend

Both services the app talks to allow cross-origin browser requests:

- `https://www.worldcubeassociation.org/api/v0/*` responds with `Access-Control-Allow-Origin: *`.
- `https://live.worldcubeassociation.org/*` mounts `CORSPlug` with no origin restriction in
  production (`lib/wca_live_web/endpoint.ex`); a preflight for
  `POST /api/enter-attempt` with an `Authorization` header returns `204` with
  `Access-Control-Allow-Origin: *` and `Authorization` in the allowed headers.

So a static build can do the whole job. Adding a server would mean holding other people's
scoretaking tokens, which is a liability we have no reason to take on.

## WCA website

### Public competition data — no auth

```
GET https://www.worldcubeassociation.org/api/v0/competitions/{competitionId}/wcif/public
```

Gives `events[].rounds[]` with `id`, `format`, `timeLimit { centiseconds, cumulativeRoundIds }`,
`cutoff`, and `persons[]` with `name`, `wcaUserId`, `wcaId`, `registrantId`, `countryIso2`,
`registration.eventIds`, `roles`. This is the whole basis of competition mode; no login needed.

```
GET https://www.worldcubeassociation.org/api/v0/competitions/{competitionId}
```

Gives `delegates` and `organizers` for the permission hint, plus name and dates for display.

### Sign-in — OAuth implicit flow

The app is a public client with no secret, so it uses the implicit flow, as
[`thewca/scrambles-matcher`](https://github.com/thewca/scrambles-matcher) and Groupifier do:

```
https://www.worldcubeassociation.org/oauth/authorize
  ?client_id=<VITE_WCA_OAUTH_CLIENT_ID>
  &response_type=token
  &redirect_uri=<app origin + basename>
  &scope=public manage_competitions
```

The access token comes back in the URL **fragment** (`#access_token=…&expires_in=…`). The app
reads it before the router mounts, clears the fragment immediately, and stores the token with
its expiry. There is no refresh token: when it expires, the user signs in again. Authenticated
calls carry `Authorization: Bearer <token>`.

Signed-in calls the app makes:

- `GET /api/v0/me` — who is signed in.
- `GET /api/v0/competitions?managed_by_me=true` — the competitions the user manages, used to
  offer a list instead of typing an id. (Unauthenticated, this returns `401`.)

Scope `manage_competitions` is requested because the managed-competitions list needs it. The app
never writes anything to the WCA website.

## WCA Live

### Reading results — no auth

```
GET https://live.worldcubeassociation.org/api/competitions/{competitionWcaId}/results
```

Public, CORS-open, keyed by WCA competition id. Returns
`{ events: [{ eventId, rounds: [{ number, results: [{ personId, ranking, best, average, attempts: [centiseconds] }] }] }], persons: [...] }`,
where `personId` is the registrant id and results with no attempts are omitted. This is how the
app learns what another scoretaker already entered.

Polled, not subscribed: every 30s while a group's board is open and on window focus, and once
immediately before a submission. WCA Live also exposes a GraphQL API with subscriptions at
`/api`, but it is keyed by WCA Live's internal ids and needs a session; the REST results
endpoint is enough and cheaper.

### Writing attempts — scoretaking token

```
POST https://live.worldcubeassociation.org/api/enter-attempt
Authorization: Bearer <scoretaking token>
Content-Type: application/json

{ "competitionWcaId": "ExampleOpen2026", "eventId": "333bf",
  "roundNumber": 1, "registrantId": 12, "attemptNumber": 2, "attemptResult": 6421 }
```

`attemptResult` uses the same encoding as everywhere else: centiseconds, `-1` DNF, `-2` DNS.
A `200` with an empty body means it landed. WCA Live recomputes ranking and advancement itself.

`POST /api/enter-results` submits a whole round at once and is **not** used: it replaces every
attempt for the competitors in the payload, so two scoretakers working the same round can
overwrite each other. One attempt at a time is what FKMTime does and what this app does.

Error responses, from `lib/wca_live_web/controllers/competition_controller.ex`:

| Status | Cause | What the app says |
| --- | --- | --- |
| `400` | Payload missing a field | Internal error; report it. This is our bug |
| `401` | `no authorization token provided` / `invalid token format` / `the provided token is not valid` / `the provided token does not grant access to this competition` / `the token user no longer have access to this competition` | Surface the message verbatim plus the fix: re-generate the token on WCA Live for *this* competition |
| `404` | Competition, round, or the competitor's result row not found | Usually: the round is not open on WCA Live yet, or the competitor is not in that round. Say that |
| `422` | Validation failure, e.g. an attempt number beyond the round format | Show the returned messages |

### The token

A scoretaking token is generated by each scoretaker on their **WCA Live account page**, is
**scoped to one competition and one user**, is stored hashed on WCA Live's side, and is valid
for **7 days** from creation (`@validity_in_days 7` in
`lib/wca_live/accounts/scoretaking_token.ex`). WCA Live re-checks on every call that the user
still has scoretaking access to that competition.

In this app:

- Tokens are stored in `localStorage`, keyed by competition id, alongside the timestamp they
  were entered.
- Once entered, a token is displayed masked (last 4 characters), never in full, and never
  logged, never put in a URL, never sent anywhere but `live.worldcubeassociation.org`.
- After 7 days from entry the app marks it expired and asks for a new one before allowing
  submissions — cheaper than discovering it during a round.
- "Forget token" is one click, on the competition screen and in settings, and clearing site
  data is documented as the complete answer.
- A token pasted for competition A is never used for competition B, even if the user switches
  competitions in the same session.

Because the token sits in `localStorage`, an XSS bug in this app is a token-theft bug. That
raises the bar on dependencies and on anything that renders untrusted strings — see
[SPEC-005](SPEC-005-architecture.md).

## Permission gate

Mode 3 requires, in order:

1. A WCA sign-in. Without it, the mode is not offered.
2. A permission check, for the warning only: the signed-in `wcaUserId` is a `delegate`,
   `trainee-delegate` or `organizer` in the competition's WCIF `persons[].roles`, or the
   competition appears in `competitions?managed_by_me=true`.
3. A scoretaking token for that competition.

If (2) fails the app says so plainly — "we cannot see that you manage this competition; if you
are staff with scoretaking access, WCA Live will still accept your token" — and lets the user
continue. WCA Live grants scoretaking access to staff members flagged as scoretakers
(`lib/wca_live/scoretaking/access.ex`), which is not visible in any public API, so a hard block
here would lock out legitimate scoretakers. The real gate is WCA Live's own `401`.

## Submission rules

- **Local first.** An attempt is written to local state and rendered before any request is made.
  The budget never waits on the network.
- **Online only, and honest about it.** Submissions are attempted only when the browser reports
  itself online. Offline, the submit controls are disabled with an explanation and attempts stay
  `Local`. The app does not hold a background queue that pretends the work is done — a
  scoretaker who thinks an attempt reached WCA Live when it did not is worse off than one who
  can see that it did not.
- **Retry is explicit and idempotent.** Retrying re-sends the same
  `(competition, event, round, registrant, attemptNumber)` with the current local value;
  WCA Live overwrites that one attempt, so a retry can never duplicate anything.
- **One in flight per attempt.** Editing an attempt mid-submission cancels the display of the
  older response; the last committed local value is always what gets sent.
- **Elapsed times never leave the browser.** A DNF's counted time is ours; WCA Live receives
  `-1`.

## Merging what WCA Live already has

When results are read back for a round, per competitor and attempt number:

| Local | WCA Live | Result |
| --- | --- | --- |
| skipped | a value | Take WCA Live's value; if it is DNF, mark the elapsed time unknown |
| a value, `On WCA Live`, equal | equal | Nothing to do |
| a value, `On WCA Live`, different | different | Somebody changed it elsewhere: take WCA Live's value, keep our elapsed time, flag the row as changed remotely |
| a value, `Local` or `Failed` | a value | Keep ours, show both, offer "submit mine" or "take WCA Live's" |
| a DNF with elapsed time | DNF | Keep the elapsed time. WCA Live cannot store it |

Merging never happens silently in the direction that loses a locally recorded elapsed time.

## Configuration

| Variable | Meaning |
| --- | --- |
| `VITE_WCA_ORIGIN` | `https://www.worldcubeassociation.org`, or the staging site |
| `VITE_WCA_OAUTH_CLIENT_ID` | Public client id of the registered OAuth application |
| `VITE_WCA_LIVE_ORIGIN` | `https://live.worldcubeassociation.org` |

No secret is ever needed, and none is ever committed. A staging build points all three at the
WCA staging environment and its own OAuth application.
