# SPEC-001 — Product

## The problem

A cumulative time limit is a budget shared by several attempts: "20:00 cumulative for the
round", or "20:00 cumulative across 3BLD, 4x4x4, 6x6x6, Clock and Megaminx first rounds"
([A1a2](https://www.worldcubeassociation.org/regulations/#A1a2)). Whoever runs that station
has to answer one question, repeatedly and under pressure:

> **How long is this competitor allowed to run on their next attempt?**

The answer is arithmetic over data that is scattered — previous attempts live on a scorecard,
DNF attempts count for their *elapsed* time rather than their result
([A1a5](https://www.worldcubeassociation.org/regulations/#A1a5)), and when the budget runs out
every remaining attempt becomes DNS
([A1a2+++++](https://www.worldcubeassociation.org/regulations/#A1a2)). It is easy to get wrong,
and getting it wrong means either an unfair extra minute or an attempt stopped too early.

Existing tools either do the sum and nothing else (no WCA time input, no DNF elapsed time, no
competitor context), or they are full scoretaking systems where the cumulative budget is not a
first-class thing. This app is the narrow tool: the budget is the product.

## Who it is for

| User | Needs |
| --- | --- |
| **Judge / station runner** at a cumulative station | One competitor at a time, on a phone, one-handed: what is left, what is the cap for the next attempt |
| **Scoretaker** for a cumulative round | Enter attempts for many competitors, see who is close to the limit, push results to WCA Live |
| **Delegate / organizer** | Sanity-check a competitor's budget mid-round; settle a dispute about a stopped attempt |
| **Anyone, at home** | Work out a limit without a competition attached |

## The three modes

The app has one engine and three ways in. Each mode is strictly more capable than the previous
one, and the step up is explicit — nothing is silently upgraded.

### 1. Calculator — no login, no competition

The replacement for "type numbers into a box". Choose an event and a number of attempts (or
pick a preset like "3BLD, best of 3, 20:00 cumulative"), enter the limit, then enter attempts
with real WCA time input. Shows used, remaining, and the cap for the next attempt; handles DNF
elapsed time and auto-DNS on exhaustion.

State lives in the URL and in `localStorage`, so a reload or a shared link keeps the numbers.

### 2. Competition, local — no login required

Enter a competition id, the app loads the **public WCIF** from the WCA
(`GET /api/v0/competitions/{id}/wcif/public` — no auth, CORS open). From it the app knows the
events, the rounds, the formats, the cumulative groups and the registrant list. The user picks
a cumulative group (or a single round) and gets a board of the competitors registered for it.

Everything entered is stored in `localStorage` only. Nothing is sent anywhere. This is the mode
for a station that is tracking the budget while somebody else does the official scoretaking.

Signing in with WCA is optional here and only buys convenience: a list of the competitions you
manage instead of typing an id.

### 3. Competition, WCA Live — sign-in + scoretaking token

Everything in mode 2, plus each attempt is submitted to WCA Live as it is entered, and already
entered attempts are read back from WCA Live so the budget is right even when another
scoretaker entered some of them.

Available only when **both** hold:

- the user has signed in with WCA (implicit OAuth, scope `public manage_competitions`), and
- the user has pasted a WCA Live scoretaking token for that competition.

The app checks client-side whether the signed-in user looks like a manager of that competition
(delegate or organizer in the WCIF, or the competition appears in their managed list) and warns
when they do not — but that check is UX, not security. WCA Live itself is the authority: it
rejects a token that does not belong to the competition or whose user has lost scoretaking
access. WCA Live also grants scoretaking to staff members who are neither delegate nor
organizer, and that is invisible to us, so the warning must be dismissible rather than a wall.

See [SPEC-004](SPEC-004-integrations.md) for the mechanics.

## What the app does that a sum does not

1. **Every attempt is entered as a time, with a DNF tickbox beside it.** A DNF is recorded as
   `DNF (10:00)` on the scorecard
   ([A1a2+](https://www.worldcubeassociation.org/regulations/#A1a2)) and the 10:00 is what eats
   the budget ([A1a5](https://www.worldcubeassociation.org/regulations/#A1a5)). So the app never
   asks "time *or* DNF": it takes the time the judge read off the timer, and the tickbox decides
   what goes on the results. WCA Live receives the DNF; the time stays here, because WCA Live
   has nowhere to put it.
2. **"Stopped at the limit" is one action.** When a competitor hits the budget mid-attempt, the
   judge stops the solve ([A1a4](https://www.worldcubeassociation.org/regulations/#A1a4)). One
   button records DNF with elapsed time exactly equal to the remaining budget and marks every
   remaining attempt in the group DNS.
3. **The cap for the next attempt is stated, not implied.** `min(per-attempt limit, remaining)`
   ([A1a2](https://www.worldcubeassociation.org/regulations/#A1a2)), shown in the size of type
   you can read across a table.
4. **Groups spanning several events are one budget.** A limit shared by 3BLD, 4x4x4 and Clock
   first rounds is tracked as a single budget per competitor, across events, in the order the
   attempts were actually done
   ([A1a2++++++](https://www.worldcubeassociation.org/regulations/#A1a2)).
5. **Unknown elapsed time is visible.** A DNF with no elapsed time recorded makes the remaining
   budget an upper bound, and the app says so instead of quietly counting zero
   ([A1a2+++](https://www.worldcubeassociation.org/regulations/#A1a2)).

## Scope

In scope for v1:

- Timed events only.
- Rounds with a cumulative limit, and rounds with a per-attempt limit (the degenerate case).
- Entering attempts, and submitting them to WCA Live one attempt at a time.
- Reading back already-entered results from WCA Live's public results endpoint.

Explicitly **not** in scope:

- 3x3x3 Fewest Moves and 3x3x3 Multi-Blind entry. Neither can have a cumulative limit
  ([A1a2](https://www.worldcubeassociation.org/regulations/#A1a2)) and both need their own input
  widgets; those rounds are shown as unsupported rather than half-working.
- Rankings, advancement, cutoff enforcement, record detection, projector views, scorecards —
  WCA Live does those. The app shows a cutoff where it changes how many attempts a competitor
  will take, and stops there.
- Opening or closing rounds on WCA Live, or any other administrative mutation. The app writes
  attempts and nothing else.
- Multi-device sync, accounts, or any server of our own. There is no backend.

## Decisions

- **Three tiers, not two.** The competition-backed local mode does not require a WCA login,
  because the public WCIF already carries everything it needs. Login is the price of writing to
  WCA Live, not of reading public data.
- **Cumulative-focused, not a WCA Live clone.** The entry UI exists so that the person tracking
  the budget does not have to enter the same attempt twice. Parity with WCA Live's admin is a
  non-goal.
- **No backend, ever.** Both the WCA API and WCA Live send `Access-Control-Allow-Origin: *`, so
  a static build can talk to them directly. This keeps the app deployable to GitHub Pages and
  keeps competitors' data out of any storage we would have to run.
