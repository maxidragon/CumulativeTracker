# Cumulative Tracker

A frontend-only tool for WCA **cumulative time limits**: how much of the limit a competitor has
used, how much is left for their next attempt, and — for scoretakers — entering those attempts
into WCA Live.

**Live:** <https://maxidragon.github.io/CumulativeTracker/>

## What it does

- **Calculator** — no sign-in, no competition. Pick a limit and a number of attempts, enter
  times, and see what is used and what remains. Nothing is saved.
- **Competition** — search for a competition and open one of its cumulative time limits. Every
  competitor in that group is listed with their used and remaining time; pick one to enter
  their attempts. Tracking stays in your browser.
- **WCA Live** — sign in with WCA and paste a WCA Live scoretaking token. Confirming a
  competitor's scorecard submits their attempts to WCA Live, one request per attempt.

A DNF is entered as its elapsed time with the DNF button on, because a DNF still spends that
time out of the cumulative limit
([A1a5](https://www.worldcubeassociation.org/regulations/#A1a5)) while WCA Live only records
`DNF`. When several events share one limit, the order the attempts were done in decides how the
limit runs out, and attempts can be reordered to match.

## Development

Requires Node.js 24 and npm.

```sh
npm install
npm run dev
```

Configuration comes from environment variables (see [`.env.example`](.env.example)):

| Variable | Purpose |
| --- | --- |
| `VITE_WCA_ORIGIN` | WCA website and API; defaults to the production WCA |
| `VITE_WCA_OAUTH_CLIENT_ID` | Client id of the WCA OAuth application; sign-in is disabled without it |
| `VITE_WCA_LIVE_ORIGIN` | WCA Live API; defaults to production WCA Live |
| `WCA_LIVE_PROXY_TARGET` | Development only: proxy `/wca-live` to a local WCA Live API that sends no CORS headers (set `VITE_WCA_LIVE_ORIGIN=/wca-live`) |

Put local overrides in `.env.development.local`, which git ignores.

Before opening a pull request, run the same checks as CI:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentation

Start at [`docs/specs/README.md`](docs/specs/README.md).

| Spec | Covers |
| --- | --- |
| [SPEC-001](docs/specs/SPEC-001-product.md) | Product: users, the three modes, scope |
| [SPEC-002](docs/specs/SPEC-002-cumulative-model.md) | The regulations, the arithmetic, the data model |
| [SPEC-003](docs/specs/SPEC-003-ui.md) | Screens, attempt input, keyboard model |
| [SPEC-004](docs/specs/SPEC-004-integrations.md) | WCA OAuth, WCIF, WCA Live API, offline rules |
| [SPEC-005](docs/specs/SPEC-005-architecture.md) | Stack, storage, testing, CI, milestones |

## License

[MIT](LICENSE)
