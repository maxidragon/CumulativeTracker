# Cumulative Tracker

A pure-frontend tool for WCA **cumulative time limits**: how much of the budget a competitor has
spent, how long they may run on their next attempt, and — for scoretakers — entering those
attempts into WCA Live as they happen.

Three ways in, each a step up from the last:

1. **Calculator** — no login, no competition. A limit, some attempts, the answer.
2. **Competition, local** — load a competition's public WCIF, pick a cumulative group, track
   every competitor in it. Stored in your browser, sent nowhere.
3. **WCA Live** — sign in with WCA, paste a scoretaking token, and each attempt goes to
   WCA Live as you enter it.

Attempts are always entered as a **time with a DNF tickbox**, because a DNF still spends its
elapsed time out of the cumulative budget
([A1a5](https://www.worldcubeassociation.org/regulations/#A1a5)) and WCA Live has nowhere to
store that time.

## Status

Specification stage. The implementation starts from scratch; the earlier prototype was removed
and remains in git history.

## Documentation

Start at [`docs/specs/README.md`](docs/specs/README.md).

| Spec | Covers |
| --- | --- |
| [SPEC-001](docs/specs/SPEC-001-product.md) | Product: users, the three modes, scope |
| [SPEC-002](docs/specs/SPEC-002-cumulative-model.md) | The regulations, the arithmetic, the data model |
| [SPEC-003](docs/specs/SPEC-003-ui.md) | Screens, attempt input, keyboard model |
| [SPEC-004](docs/specs/SPEC-004-integrations.md) | WCA OAuth, WCIF, WCA Live API, offline rules |
| [SPEC-005](docs/specs/SPEC-005-architecture.md) | Stack, storage, testing, CI, milestones |
