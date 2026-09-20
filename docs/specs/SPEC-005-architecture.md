# SPEC-005 — Architecture

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | Vite + TypeScript (`strict`) | Static output, fast dev, no server to run |
| UI | React + MUI | Asked for, and WCA Live is MUI too, so the two feel related |
| Routing | React Router (`BrowserRouter` with a basename) | Deep links to a group or a competitor; the URL fragment is reserved for the OAuth token |
| Remote data | TanStack Query | Caching, refetch on focus, polling, request de-duplication — all needed for the WCA Live results poll |
| Local state | Zustand with a persisting middleware | The tracker state is small, synchronous and must survive a reload; Redux would be ceremony |
| Event icons | `@cubing/icons` | The standard set |
| WCIF types | `@wca/helpers` | Official types for the WCIF payload; formatting stays ours |
| Tests | Vitest + Testing Library | Same toolchain as the build |

Versions are pinned at install time; this spec does not restate them.

## Shape

```
src/
  app/            router, providers, MUI theme, error boundary
  features/
    calculator/   standalone calculator screen
    competition/  competition load, group selection, board, competitor view
    entry/        attempt input and its keyboard model
    live/         WCA Live submission, sync state, reconciliation
    auth/         WCA OAuth, session, permission hint
    settings/     theme, stored data, tokens
  lib/
    cumulative/   the engine from SPEC-002 — pure, no React, no network
    attempt/      result encoding, parsing, formatting, autocomplete
    wca/          WCA website client (WCIF, me, competitions)
    wcaLive/      WCA Live client (results, enter-attempt)
    storage/      localStorage schema, versioning, migrations
  components/     shared presentational components
```

Two rules hold this together:

1. **`lib/cumulative` imports nothing but `lib/attempt`.** No React, no MUI, no fetch. Every
   rule from [SPEC-002](SPEC-002-cumulative-model.md) is a pure function over the data model and
   is tested as such. If a regulation question can only be answered by rendering a component,
   the code is in the wrong place.
2. **Features talk to services through `lib/*` clients**, never `fetch` inline. That is what
   makes the WCA Live error mapping from [SPEC-004](SPEC-004-integrations.md) exist in exactly
   one place.

## Local storage

One namespace, one version, explicit migrations:

```
ct:v1:settings                       theme, preferences
ct:v1:session                        WCA access token + expiry (cleared on expiry)
ct:v1:token:<competitionId>          WCA Live scoretaking token + entered-at
ct:v1:wcif:<competitionId>           cached public WCIF + fetched-at
ct:v1:budgets:<competitionId>        tracked attempts, keyed by groupKey + registrantId
ct:v1:recent                         recently opened competitions
```

- Every write goes through `lib/storage`, which validates the shape on read and drops anything
  it cannot parse rather than crashing a scoretaker mid-round.
- The version segment bumps when a shape changes, with a migration from the previous version.
  A missing migration means "start clean", never "render garbage".
- Settings has a **Clear all data** action that enumerates what it will delete, including
  tokens.
- Nothing is ever written to storage that the user did not enter or that the WCA did not
  publish.

## Failure behaviour

- A failed WCIF fetch shows the competition id that failed and a retry, and falls back to the
  cached WCIF if one is present, labelled with its age.
- A React error boundary wraps each route and offers "reload" and "export my data" — losing a
  round's worth of tracking to a render bug is not acceptable.
- The app renders and stays usable with no network for calculator and local modes.

## Security posture

The WCA Live scoretaking token lives in `localStorage`, so an XSS bug is a credential-theft bug.
Accordingly:

- No `dangerouslySetInnerHTML`, ever. Competitor names are rendered as text.
- Dependencies are few and boring; anything new gets justified in the PR that adds it.
- No analytics, no third-party scripts, no error-reporting service that would receive tokens.
- Tokens are masked in the UI and excluded from any diagnostic export.

## Testing

| Layer | What gets tested |
| --- | --- |
| `lib/cumulative` | Every rule and every worked example in [SPEC-002](SPEC-002-cumulative-model.md). This is where coverage must be near-total |
| `lib/attempt` | Parsing, formatting, the 10-minute truncation, DNF/DNS keys, round-tripping |
| `lib/wcaLive` | Request shape and the full error mapping, against mocked responses |
| Components | The attempt input's keyboard model; the competitor view's actions and their confirmations |
| Flow | Enter attempts into a multi-event group and assert board, caps and auto-DNS — no network |

Tests use invented competitions and competitors. No fixture is ever a copy of a real
competition's registration data.

## CI and delivery

GitHub Actions, two workflows:

- **CI** on every push and pull request: install, lint, typecheck, test, build.
- **Deploy** on `main` after CI passes: build with the production environment variables and
  publish to GitHub Pages at `https://maxidragon.github.io/CumulativeTracker/`.

The build sets `base` to the repository path, and the deploy step copies `index.html` to
`404.html` so client-side deep links survive a cold load on Pages.

## Milestones

| # | Deliverable | Done when |
| --- | --- | --- |
| M0 | Reset and scaffold | Old prototype removed (kept in history), Vite + MUI + router + CI building green |
| M1 | Engine and attempt input | `lib/cumulative` and `lib/attempt` complete and tested; every SPEC-002 example passes |
| M2 | Calculator | Mode 1 usable end to end, state in the URL, deployed to Pages |
| M3 | Competition mode, local | Public WCIF load, group selection, board, competitor view, local persistence |
| M4 | WCA sign-in | Implicit flow, session handling, managed-competitions list, permission hint |
| M5 | WCA Live mode | Token handling, submission with full error mapping, results read-back and merge |
| M6 | Polish | Accessibility pass, dark mode, mobile pass, empty and error states |

Each milestone ends in a reviewable pull request. Nothing is merged and nothing is pushed
without an explicit go-ahead.

## Decisions

- **The prototype in this repository is deleted rather than refactored.** It proved the WCIF
  path and nothing else; the model in [SPEC-002](SPEC-002-cumulative-model.md) (DNF elapsed
  time, budget groups, ordering) has no overlap with it. It stays in git history.
- **Zustand over Context + reducer**: the board re-renders per keystroke in a table of up to a
  few hundred competitors, and selector-based subscriptions keep that cheap without prop-drilling.
- **Polling over GraphQL subscriptions**: the public results endpoint is keyed by WCA
  competition id and needs no session, and a 30-second poll is well inside what a round needs.
  Revisit if WCA Live's REST results endpoint ever goes away.
