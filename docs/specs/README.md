# Cumulative Tracker — specifications

Cumulative Tracker is a pure-frontend (React + Vite + MUI) tool for tracking WCA **cumulative time limits** during a competition, and for entering the resulting attempts into WCA Live.

Read them in this order:

| Spec | Title | What it settles |
| --- | --- | --- |
| [SPEC-001](SPEC-001-product.md) | Product | Who it is for, the three modes, scope and non-goals |
| [SPEC-002](SPEC-002-cumulative-model.md) | Cumulative model | The regulations, the arithmetic, the data model, the edge cases |
| [SPEC-003](SPEC-003-ui.md) | UI | Screens, attempt input, keyboard model, responsiveness |
| [SPEC-004](SPEC-004-integrations.md) | Integrations | WCA OAuth, WCIF, WCA Live API, permissions, offline rules |
| [SPEC-005](SPEC-005-architecture.md) | Architecture | Stack, state, storage, testing, CI, delivery milestones |

## Conventions

- Specs describe the target state, not the history of how we got there. When a decision
  changes, edit the spec; the reasoning that must survive goes in the "Decisions" section
  of the spec it belongs to.
- Every claim about an external system (WCA, WCA Live, the Regulations) carries a citation:
  a regulation number, an endpoint, or a source file. Anything uncited is our own choice.
- Times are always **centiseconds** in code and data, formatted only at the edge.
- Examples use invented competitions and competitors. Never paste real registration data,
  real competitor names, or live API responses into this repository.

## External prerequisites

Two things must exist outside this repository before the WCA Live mode can work end to end:

1. A **WCA OAuth application**, registered by a maintainer at
   `https://www.worldcubeassociation.org/oauth/applications`, using the implicit flow and the
   deployed origin as its redirect URI. Its client id is public and goes into the build as
   `VITE_WCA_OAUTH_CLIENT_ID` (see [SPEC-004](SPEC-004-integrations.md)).
2. A **WCA Live scoretaking token**, generated per competition by each scoretaker on their own
   WCA Live account page. The app never issues these; it only stores what the user pastes in.
