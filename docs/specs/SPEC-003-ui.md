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
| `#/` | Home: start a calculator, or open a competition by id (recent competitions listed from `localStorage`) |
| `#/calculator` | Calculator, state encoded in the route's query string |
| `#/c/:competitionId` | Competition overview: cumulative groups, rounds, mode switch, sign-in and token state |
| `#/c/:competitionId/g/:groupKey` | Board: every competitor in the group with their budget |
| `#/c/:competitionId/g/:groupKey/:registrantId` | Competitor view: attempts, entry, budget detail |
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

This is the component everything else hangs off. It is **one time field with a DNF tickbox next
to it**, not a field that holds either a time or the word DNF:

```
  Attempt 2   [   10:00.00   ]  [x] DNF   [ ] DNS        counts 10:00 · cap was 12:41
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
- **DNF** is a tickbox beside the field. Ticking it does not clear or disable the time; the
  field keeps the elapsed time and the helper text changes to `counts 10:00 towards the limit`.
  The WCA Live keys `d`, `D`, `/` and `#` toggle the tickbox from inside the field, so the
  familiar keystroke still works and now keeps the time instead of replacing it.
- **DNS** is a second tickbox. It is the one outcome with no time: ticking it empties and
  disables the time field, because a solve that never started spends nothing
  ([A1a2+++++](https://www.worldcubeassociation.org/regulations/#A1a2)). Keys `s`, `S`, `*`.
  DNF and DNS are mutually exclusive.
- An empty time with DNF ticked is **allowed** and is the honest record of a DNF nobody timed.
  It shows as `elapsed time not recorded`, and it turns the competitor's remaining budget into
  an upper bound until somebody fills it in
  ([A1a2+++](https://www.worldcubeassociation.org/regulations/#A1a2)). An `estimated` toggle
  marks a Delegate's estimate.
- An empty time with nothing ticked is a skipped attempt, not a zero.
- On commit (blur or Enter) the time is autocompleted: 10 minutes or more truncates to whole
  seconds ([9f2](https://www.worldcubeassociation.org/regulations/#9f2)). Unparseable input
  resets to empty rather than guessing.
- `Enter` commits and moves to the next attempt; `Shift+Enter` moves back; `Escape` reverts the
  field to its committed value; `Space` toggles DNF when the tickbox has focus.
- In modes where the cumulative budget is tracked, each field shows the cap that applied to that
  attempt and warns — amber helper text, never a block — when the entered time exceeds it.

The input never refuses entry it believes is wrong. The Delegate, not the app, is the authority
on what happened.

## Calculator

One column, large type, no chrome. Event selector (for result formatting), attempts count or a
round preset, the cumulative limit, then the attempts. Below them, the answer block shared with
every other screen:

```
         REMAINING              NEXT ATTEMPT CAP
          5:12.34                   5:12.34
     used 14:47.66 of 20:00      2 attempts left · avg 2:36 each
```

Presets cover the common announcements: 3BLD bo3 20:00 · 3BLD mo3 30:00 · 4BLD 60:00 ·
5BLD 60:00 · 4BLD+5BLD 60:00 shared. Presets are a convenience, never a claim about what a
competition announced.

## Board

A table on a laptop, a list of cards on a phone. One row per competitor registered for any
round in the group, sorted by remaining budget ascending by default (the competitors closest to
trouble first), with a name/registrant-id search that matches on both and a keyboard shortcut
(`/`) to focus it.

Columns: competitor (name, registrant id, country flag), per-round attempt chips, used,
remaining, next cap, status. In WCA Live mode a sync column shows per-competitor submission
state.

Status is never colour alone — every state carries an icon and a word:

| Status | Meaning |
| --- | --- |
| `Not started` | No attempts entered |
| `On track` | Remaining is comfortably above the average needed per remaining attempt |
| `Tight` | Remaining is below the average needed for the attempts left |
| `Exhausted` | `remaining <= 0`; remaining attempts should be DNS |
| `Incomplete` | A DNF is missing its elapsed time; remaining is an upper bound |

## Competitor view

The judge's screen. Everything above the fold on a phone:

1. Competitor name and registrant id.
2. The cap for the next attempt, in the largest type on the screen.
3. Remaining, used, limit.
4. The attempts, in group order, each editable in place, each showing which round it belongs to
   when the group spans several events.
5. Actions: **Stopped at the limit**, **DNS the rest**, and (WCA Live mode) **Submit**.

Destructive or regulation-bearing actions — "stopped at the limit", "DNS the rest", clearing a
competitor — confirm once, in a dialog that states exactly what will change, including which
attempts in which rounds.

## Sync, in WCA Live mode

Every attempt carries a small, unambiguous state: `Local` (entered, not sent), `Sending`,
`On WCA Live`, `Failed`. What is sent is the official result — a time, or `-1` for a ticked DNF,
or `-2` for DNS — never the elapsed time behind a DNF. Failed attempts show the reason from
WCA Live and a retry button.
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
- **Accessibility**: every interactive element is reachable and operable by keyboard; status is
  conveyed by icon + text as well as colour; live-updating numbers are announced politely via
  `aria-live` on the remaining-budget block, not on every keystroke.
- **Offline shell**: the app renders and works for calculator and local modes without a network
  once loaded; there is no service worker in v1, so a hard reload still needs the network.
- **Errors are actionable.** "WCA Live rejected this attempt: the round is not open yet. Open
  the round in WCA Live, then retry." beats a status code.
