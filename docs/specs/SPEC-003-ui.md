# SPEC-003 — UI

MUI, light and dark, mobile-first. The people using this are standing at a table in a noisy
hall holding a phone in one hand, or sitting at a scoretaking laptop typing fast without
looking. Those two situations drive every decision below.

## Routes

Routing uses **`HashRouter`**. GitHub Pages has no rewrite rule, so a cold load of a deep path
under `BrowserRouter` is served as a 404; the `404.html` workaround exists but returns an HTTP
404 status and re-enters the app through an error page. A hash route is just a fragment — Pages
only ever serves `index.html`, and deep links work without any server-side cooperation.

| Route | Screen |
| --- | --- |
| `#/` | Home: a single competition search (WCA name search; recent competitions shown before typing; a bare id opens directly), and below it the signed-in user's managed competitions that ended at most a week ago, soonest first, with city, country and dates. The calculator lives in the navbar |
| `#/calculator` | Calculator; nothing is saved, a reload starts fresh |
| `#/c/:competitionId` | Competition overview: one card per cumulative time limit (limit, then its events and rounds), full width; WCA Live mode and token live in a dialog behind a header button |
| `#/c/:competitionId/g/:groupKey` | Group workspace: every competitor in the group with their budget |
| `#/c/:competitionId/g/:groupKey/:registrantId` | Group workspace with that competitor's entry panel open |
| `#/settings` | Theme, stored tokens, stored competition data, clear-everything |

### The hash is shared with OAuth

WCA's implicit flow returns the access token in the URL fragment, which is the same character a
hash router lives in. They do not actually collide, as long as the order is fixed and never
varies:

1. Before signing in, the current hash route and a random `state` nonce are stashed in
   `sessionStorage`.
2. WCA redirects back to the app root with `#access_token=…&state=…&expires_in=…`. There is no
   route in that fragment, by construction.
3. **The very first statement the app runs**, before React and before the router mounts, checks
   whether the fragment parses as OAuth parameters rather than a route — the test is the
   presence of `access_token`. If it does, the token is taken, `state` is verified against the
   stashed nonce, and the fragment is immediately replaced with the stashed return route via
   `history.replaceState`.
4. Only then does the router mount, and it sees an ordinary route.

This is the same trick `thewca/scrambles-matcher` uses ("should be called on application
initialization, before any kind of router takes over the location"); the only addition is
restoring the route the user came from, which matters more here because the fragment they left
from is the one WCA overwrites.

A fragment that contains `error=` (the user denied access) is handled in the same step: no
token, return route restored, message shown.

## The attempt input

This is the component everything else hangs off. It is **one time field with a DNF toggle button next
to it**, not a field that holds either a time or the word DNF:

```
  ┌ Attempt 2 ─────────────┐ ┏━━━━━┓ ┌─────┐
  │ 10:00.00               │ ┃ DNF ┃ │ DNS │
  └────────────────────────┘ ┗━━━━━┛ └─────┘
```

The reason is [A1a5](https://www.worldcubeassociation.org/regulations/#A1a5): a DNF spends its
elapsed time out of the cumulative budget, so the time must be captured even when the official
result is DNF. WCA Live gets `-1`; the time stays local. Asking for the time first and the
outcome second also matches what the judge does — read the timer, then decide.

Behaviour:

- The time field copies WCA Live's input exactly, because scoretakers already have it in their
  fingers and a second, different time input at the same competition causes errors. Modelled on
  `wca-live`'s `client/src/components/admin/AttemptResultField/TimeField.jsx`:
  `<input type="tel">`, digits only, filled **right to left** into the `hh:mm:ss.cc` slots —
  typing `25000` shows `2:50.00` and `12345` shows `1:23.45` — with leading zeros and colons
  stripped. Digits are slots, not a count of centiseconds. A slot may overflow as it can in
  WCA Live (`9999` is 99.99 seconds, committed as `1:39.99`), and input stops at eight digits.
- **DNF** is a toggle button beside the field. Ticking it does not clear or disable the time; the
  field keeps the elapsed time, which still counts towards the limit.
  The WCA Live keys `d`, `D`, `/` and `#` toggle it from inside the field, so the
  familiar keystroke still works and now keeps the time instead of replacing it.
- **DNS** is a second toggle button. It is the one outcome with no time: ticking it empties and
  disables the time field, because a solve that never started spends nothing
  ([A1a2+++++](https://www.worldcubeassociation.org/regulations/#A1a2)). Keys `s`, `S`, `*`.
  DNF and DNS are mutually exclusive.
- An empty time with DNF ticked is **allowed** and is the honest record of a DNF nobody timed.
  It shows as `Elapsed time not recorded`, and it turns the competitor's remaining budget into
  an upper bound until somebody fills it in
  ([A1a2+++](https://www.worldcubeassociation.org/regulations/#A1a2)).
- An empty time with nothing ticked is a skipped attempt, not a zero.
- On commit (blur, Enter or an arrow key) the time is autocompleted: 10 minutes or more truncates to whole
  seconds ([9f2](https://www.worldcubeassociation.org/regulations/#9f2)). Unparseable input
  resets to empty rather than guessing.
  Committing an attempt that did not change is a no-op: it keeps its timestamp and is not sent
  to WCA Live again, so moving through filled fields is safe.
- Moving between attempts works as in WCA Live — the cursor goes field to field:
  - `Enter` commits and moves to the next attempt; `Shift+Enter` moves back.
  - `↓` and `↑` commit and move to the next or previous attempt, stopping at either end.
  - `Tab` goes to the next attempt field. The DNF and DNS toggle buttons beside the field are
    left out of the tab order because `d` and `s` toggle them from the field; they stay
    clickable.
  - `Escape` reverts unsaved typing; pressed again (nothing left to revert) it leaves the
    scorecard for the competitor search.
  - In groups that span several events, `Alt+↑` and `Alt+↓` move the attempt earlier or later
    in the order it was done, and the cursor stays on it.
- In modes where the cumulative budget is tracked, each field shows the cap that applied to that
  attempt and warns — amber helper text, never a block — when the entered time exceeds it.

The input never refuses entry it believes is wrong. The Delegate, not the app, is the authority
on what happened.

## Calculator

Two columns on desktop (at most ~1040px wide), one on a phone. The left column holds the
setup — the cumulative limit and the attempts count — and under it the answer: **Remaining** in
the largest type, with the attempts left, then **Used** of the limit. The right column holds
the attempts, then **Stopped at the limit** and **DNS the rest**.

```
  Cumulative limit [20:00.00 ▾]     ┌ Attempt 1 ───────────┐ [DNF] [DNS]
  Attempts         [3 ▾]            │ 14:47.66             │
                                    └──────────────────────┘
  REMAINING                         ┌ Attempt 2 ───────────┐ [DNF] [DNS]
  5:12.34                           └──────────────────────┘
  2 attempts left                   ...
  USED
  14:47.66
  of 20:00.00
```

The limit is picked from common announcements (10, 12, 15, 20, 60, 90 or 120 minutes) or typed
as a custom limit; the attempts count is 1, 2, 3, 5 or a custom count. Presets are a
convenience, never a claim about what a competition announced.

`Reset`, beside the title, empties every attempt for the next competitor and keeps the setup
(limit and attempts count). It asks for confirmation and is disabled while no attempt is
entered.

## Group workspace

The scoretaker's screen, laid out for a laptop first. The board and the competitor view are
one screen on one route (`:registrantId` is optional), so moving between scorecards never
reloads the table or loses the search.

It follows WCA Live's scoretaking layout, because scoretakers already know it: on a laptop the
entry column sits on the left — the competitor field on top, the picked competitor's attempts
below it — and the round's table fills the rest. On a phone the entry column comes first and
the table is hidden while a competitor is open; the panel's close button returns to it.

### The keyboard loop

Entering a stack of scorecards should never need the mouse:

1. `/` focuses the competitor search from anywhere outside a field.
2. Type a registrant id (or part of a name) and press `Enter`. An exact registrant id wins;
   otherwise the first row of the filtered table. `↓` and `↑` pick a row instead (it is
   outlined in the table and scrolled into view), and `Enter` opens that one. The search clears
   and the panel opens.
3. The cursor lands on that competitor's **next empty attempt**, not the first one, so a
   scorecard that comes back for its third attempt continues where it stopped.
4. `Enter` commits each attempt and moves to the next ([attempt input](#the-attempt-input)).
   `Enter` on the last attempt returns the cursor to the search, ready for the next scorecard.

`Escape` in the search clears it, and `Escape` in an attempt field with nothing to revert
returns to the search. `?` outside a field — or the `Shortcuts` button above the table — lists
every shortcut.

### Table

One row per competitor registered for any round in the group, sorted by remaining budget
ascending (the competitors closest to trouble first), filtered live by the search, which
matches name and registrant id. The open competitor's row is highlighted.

Columns, as in WCA Live's round table: registrant id, competitor (name, country flag), then one
column per attempt — grouped under each event's icon and id when the group spans several
events, with a DNF showing its elapsed time as `DNF (10:00)` — then remaining, next cap and
status. Clicking anywhere on a row opens that competitor. In WCA Live mode a sync column shows
per-competitor submission state, and the header counts the entered attempts that are not on
WCA Live yet. Used time is in the entry panel, not the table.

Status is never colour alone — every state carries an icon and a word:

| Status | Meaning |
| --- | --- |
| `Not started` | No attempts entered |
| `On track` | Remaining is comfortably above the average needed per remaining attempt |
| `Tight` | Remaining is below the average needed for the attempts left |
| `Exhausted` | `remaining <= 0`; remaining attempts should be DNS |
| `Incomplete` | A DNF is missing its elapsed time; remaining is an upper bound |

### Entry panel

What the judge or scoretaker needs, top to bottom:

1. Competitor name and registrant id, shown in the competitor search field itself.
2. One line: time used and time remaining of the cumulative limit.
3. Warnings: missing elapsed times, exhausted budget, offline, WCA Live unreachable.
4. The attempts, in group order, each editable in place. In WCA Live mode each entered attempt
   carries one line of sync state. Where WCA Live holds a different value it says so, with a
   `Use WCA Live's` button; otherwise confirming the scorecard submits ours over it.
5. The confirm button: **Submit to WCA Live** in WCA Live mode (sends every pending attempt,
   one request per attempt), **Done** in local mode. Either closes the scorecard and returns
   to the competitor search; a failed submission or a conflict keeps it open instead. Enter on
   the last attempt presses it.
6. Actions: **Stopped at the limit**, **DNS the rest**, and **Clear competitor**.

When the group spans several events the order the attempts were *done* decides how the budget
runs out ([A1a2++++++](https://www.worldcubeassociation.org/regulations/#A1a2)), so the panel
says so above the list and makes the sequence explicit: every attempt is a card with a large
drag handle down its left edge, a numbered badge (its place in the sequence), the event icon,
and "done earlier" / "done later"
buttons, which `Alt+↑` / `Alt+↓` press from the field. Fields are labelled by the event's short name (`4x4 BLD · attempt 1`). A single-event group has only
one possible order, shows none of this, and labels fields `Attempt 1`.

Destructive or regulation-bearing actions — "stopped at the limit", "DNS the rest", clearing a
competitor — confirm once, in a dialog that states exactly what will change, including which
attempts in which rounds.

## Sync, in WCA Live mode

Every attempt carries a small, unambiguous state: `Local` (entered, not sent), `Sending`,
`On WCA Live`, `Failed`. What is sent is the official result — a time, or `-1` for a ticked DNF,
or `-2` for DNS — never the elapsed time behind a DNF. Failed attempts show the reason from
WCA Live; confirming the scorecard again retries them.
Nothing is ever shown as sent that has not been acknowledged with a `200`.

When the browser is offline the submit controls are **disabled with an explanation**, not
queued: the app does not promise to deliver something later that it may never be able to
deliver ([SPEC-004](SPEC-004-integrations.md) fixes this rule). Entry itself keeps working; the
attempts sit as `Local` and can be sent when the connection is back.

## Craft

- **Dark mode** follows the system and can be overridden; the choice is remembered.
- **Type scale**: the two numbers that matter (remaining, next cap) are at least `h3` on
  desktop and `h4` on mobile, tabular figures, so they do not reflow as digits change.
- **Touch targets** are at least 44px; the attempt fields on mobile are full-width.
- **Accessibility**: every interactive element is reachable and operable by keyboard — the
  attempt DNF/DNS toggles and reorder arrows through their keys in the field (declared with
  `aria-keyshortcuts`) rather than as tab stops; status is
  conveyed by icon + text as well as colour; live-updating numbers are announced politely via
  `aria-live` on the remaining-budget block, not on every keystroke.
- **Offline shell**: the app renders and works for calculator and local modes without a network
  once loaded; there is no service worker in v1, so a hard reload still needs the network.
- **Errors are actionable.** "WCA Live rejected this attempt: the round is not open yet. Open
  the round in WCA Live, then retry." beats a status code.
