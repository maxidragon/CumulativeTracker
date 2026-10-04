# SPEC-002 — Cumulative model

This is the part that must be right. Everything else is presentation.

## Regulations this implements

| Reg | Rule | Consequence in the app |
| --- | --- | --- |
| [A1a](https://www.worldcubeassociation.org/regulations/#A1a) | Every round has a per-attempt limit and/or a cumulative limit | A round may carry both; WCIF can only express one (see "Per-attempt limit alongside a cumulative one") |
| [A1a+](https://www.worldcubeassociation.org/regulations/#A1a) | If both apply, the per-attempt limit is not greater than the cumulative one | Validation warning when a user configures otherwise |
| [A1a1](https://www.worldcubeassociation.org/regulations/#A1a1) | Default per-attempt limit is 10:00, same for all attempts in a round | Default offered in the calculator |
| [A1a2](https://www.worldcubeassociation.org/regulations/#A1a2) | A cumulative limit applies to one round, to Dual Rounds of one event, or to a combination of rounds of different events. The limit for an attempt is `min(per-attempt limit, cumulative − time already counted)`. A round has at most one applicable cumulative limit | The **budget group** is the unit of tracking; `capForNextAttempt` is this formula |
| [A1a2+](https://www.worldcubeassociation.org/regulations/#A1a2) | The judge records a DNF's original time in parentheses, e.g. `DNF (1:02.27)` | A DNF attempt is entered as a time with DNF ticked: the time is kept locally, the result is DNF |
| [A1a2++](https://www.worldcubeassociation.org/regulations/#A1a2) | Only the **final result** counts, penalties included: 13:59 passes a 14:00 cap, 13:59+2 does not | The time entered for a non-DNF attempt is the final result, penalties already applied |
| [A1a2+++](https://www.worldcubeassociation.org/regulations/#A1a2) | If a time is unavailable, the Delegate's estimate counts towards the limit but is not an official result | A recorded time may be flagged `estimated`; it is never submitted as a result |
| [A1a2+++++](https://www.worldcubeassociation.org/regulations/#A1a2) | On reaching a cumulative limit, every remaining attempt **in the round** is DNS | Auto-DNS action, scoped per round |
| [A1a2++++++](https://www.worldcubeassociation.org/regulations/#A1a2) | For multi-event groups, attempts count in the order they were done, and that order should be on the scorecard | Attempts in a group are ordered chronologically, and the order is editable |
| [A1a4](https://www.worldcubeassociation.org/regulations/#A1a4) | The solve must end *before* the limit is reached; when the timer reaches it, the judge stops the solve and records DNF | The "stopped at the limit" action; a solved time of exactly the cap is flagged as a DNF |
| [A1a5](https://www.worldcubeassociation.org/regulations/#A1a5) | Time counting towards the limit = result after penalties, or elapsed time if DNF | `countedTime()` below |
| [9f2](https://www.worldcubeassociation.org/regulations/#9f2) | Results of 10 minutes or more are measured and truncated to seconds | Input autocompletes by truncating over 10:00 |
| [9g](https://www.worldcubeassociation.org/regulations/#9g) | A cutoff round: fail the cutoff phase and the remaining attempts are not taken | Attempts a competitor will not take stop counting as "attempts left" |

## Vocabulary

- **Attempt result** — the WCA encoding in centiseconds: `> 0` a time, `-1` DNF, `-2` DNS,
  `0` skipped (not yet entered). Same encoding WCA Live and WCIF use.
- **Counted time** — what an attempt takes out of the budget.
- **Budget group** — the set of rounds sharing one cumulative limit, from the WCIF round's
  `timeLimit.cumulativeRoundIds`. Its key is the sorted round ids joined with `+`. A round whose
  `cumulativeRoundIds` is `[]` has no cumulative limit; a round whose `cumulativeRoundIds` is
  `[itself]` is a single-round group.
- **Budget** — one competitor's instance of a group: the limit, their attempts across the
  group's rounds, and everything derived from them.

## Data model

An attempt is recorded as **a time plus an outcome**, never as "either a time or a DNF". The
time is what the timer showed; the outcome is what goes on the results. That split is forced by
[A1a5](https://www.worldcubeassociation.org/regulations/#A1a5): a DNF still spends its elapsed
time out of the budget, and WCA Live has nowhere to store that time.

```ts
type Outcome = "ok" | "dnf" | "dns" | "skipped";

type TrackedAttempt = {
  roundId: string;        // "333bf-r1"
  attemptNumber: number;  // 1-based, as WCA Live numbers them
  outcome: Outcome;
  centiseconds: number | null; // the time on the timer, penalties included; null when not recorded
  estimated: boolean;     // A1a2+++ — a Delegate's estimate, never an official result
  order: number;          // position in the group's chronological order (A1a2++++++)
  enteredAt: string;      // ISO timestamp, also the default ordering key
};

type Budget = {
  groupKey: string;
  limitCentiseconds: number;
  perAttemptLimitCentiseconds: number | null; // announced but not in WCIF; user-supplied
  registrantId: number;
  attempts: TrackedAttempt[];
};
```

Two values are derived from every attempt, and both are pure functions:

```
officialResult(a):        // what WCA Live and the scorecard get
  "ok"      -> a.centiseconds
  "dnf"     -> DNF_VALUE (-1)          // the time is ours; WCA Live never sees it
  "dns"     -> DNS_VALUE (-2)
  "skipped" -> SKIPPED_VALUE (0)

countedTime(a):           // what the budget spends — A1a5
  "ok"      -> a.centiseconds
  "dnf"     -> a.centiseconds ?? UNKNOWN
  "dns"     -> 0
  "skipped" -> 0
```

`"ok"` with `centiseconds === null` is not a valid state and is rejected on commit. `"dnf"` with
`centiseconds === null` **is** valid — it is the honest record of a DNF whose elapsed time
nobody wrote down — and it makes the remaining budget an upper bound rather than a number.

## The arithmetic

```
used(budget)       = sum of countedTime over attempts, treating UNKNOWN as 0
unknownCount       = number of "dnf" attempts with centiseconds === null
remaining(budget)  = limit - used(budget)             // may be <= 0
capForNextAttempt  = min(perAttemptLimit ?? INFINITY, remaining)   // A1a2
exhausted          = remaining <= 0
```

Where `unknownCount` counts DNF attempts with no time recorded. When `unknownCount > 0`, `remaining` is an **upper bound**, not a number. The UI renders it as
`≤ 5:12` with a "one DNF is missing its time" affordance, and the "stopped at the limit" action
is disabled until the elapsed times are filled in. Guessing zero silently would hand a
competitor time they do not have.

### Attempts left

`attemptsLeft` is not "format attempts minus entered". It is, per round in the group:

1. Start from the round's format: `1|2|3` → that many, `5|a` → 5, `m` → 3.
2. Subtract attempts already entered (any outcome other than `"skipped"`, DNS included).
3. If the round has a cutoff and the competitor has completed the cutoff phase without
   beating it ([9g](https://www.worldcubeassociation.org/regulations/#9g)), the remaining
   attempts are not taken: they count as 0.
4. If the competitor is not registered for that round's event, that round contributes 0.

`timePerRemainingAttempt = remaining / attemptsLeft` is shown as guidance when
`attemptsLeft > 1`, clearly labelled as an average, not a rule.

### Exhaustion

When `remaining <= 0` after an attempt is entered, the app offers — never performs silently —
**DNS the rest** (available once at least one attempt is entered): every `"skipped"` attempt in
the *same round* becomes DNS
([A1a2+++++](https://www.worldcubeassociation.org/regulations/#A1a2)). Rounds of other events
in the same group are a separate judgement call by the Delegate, so the app lists them as
affected and leaves them alone.

### Stopped at the limit

One action, available when `remaining > 0` and no elapsed time is unknown:

1. Set `centiseconds = remaining` — the attempt ran exactly to the cap
   ([A1a4](https://www.worldcubeassociation.org/regulations/#A1a4)).
2. Set `outcome = "dnf"`.
3. The stopped attempt becomes the last one done: it moves after every entered attempt, so
   `remaining` is what all of them left, whatever order was set before.
4. The shared limit is now spent, so every untaken attempt in the group — in any round —
   becomes DNS (flagged "auto"). Unlike "DNS the rest", there is no judgement call left: none of
   them can be taken.
5. In WCA Live mode, submit `-1` for that attempt. The elapsed time stays local — WCA Live has
   nowhere to put it.

## Edge cases and how they resolve

| Case | Resolution |
| --- | --- |
| **Per-attempt limit alongside a cumulative one** | WCIF's `timeLimit` holds a single `centiseconds` plus `cumulativeRoundIds`, so a round announced with both limits can only carry the cumulative one. The app lets the user add the per-attempt limit by hand per group, warns if it exceeds the cumulative ([A1a+](https://www.worldcubeassociation.org/regulations/#A1a)), and persists it with the group |
| **Competitor registered for only some events in the group** | Rounds they are not registered for contribute no attempts and no time; the budget is still theirs |
| **Attempts done out of round order** | Order within the group is chronological by entry, and draggable. Only the order matters for deciding which attempt hit the limit, never the sum |
| **A DNF whose elapsed time nobody wrote down** | `centiseconds = null`, flagged, `remaining` becomes an upper bound; an estimate can be entered and is marked `estimated` ([A1a2+++](https://www.worldcubeassociation.org/regulations/#A1a2)) |
| **A result over 10 minutes** | Input truncates to whole seconds on commit ([9f2](https://www.worldcubeassociation.org/regulations/#9f2)); the budget arithmetic then works on the truncated value, exactly as the official result does |
| **An attempt is edited after the budget was exhausted** | Everything is recomputed from the attempt list; no derived state is stored. DNS attempts set by "DNS the rest" are kept but flagged as "auto", so the user can see what to revisit |
| **A time entered with DNF ticked, then unticked** | The time is kept; only the outcome changes. Unticking turns the same time into the official result, which is exactly what happens when a DNF is overturned |
| **Two scoretakers entering the same round** | In WCA Live mode, results read back from WCA Live are merged (see [SPEC-004](SPEC-004-integrations.md)). Locally entered elapsed times for DNFs always survive a merge — WCA Live cannot carry them |
| **Limit of 0 or a missing limit** | The group is not trackable; the round is shown with its per-attempt limit only |
| **Dual Rounds of one event** ([9v](https://www.worldcubeassociation.org/regulations/#9v)) | Just a group whose rounds belong to the same event; no special case |

## Test obligations

The engine is pure and gets tested as such, without React. At minimum:

- `officialResult` and `countedTime` for every outcome, with and without a recorded time —
  including that a DNF with a time yields `-1` officially and spends that time from the budget.
- The worked example from
  [A1a2++](https://www.worldcubeassociation.org/regulations/#A1a2): limit 30:00, attempts
  `6:00` and `DNF (10:00)` → cap for the third attempt is `14:00`.
- The worked example from
  [A1a2++++](https://www.worldcubeassociation.org/regulations/#A1a2): cumulative 20:00 with a
  per-attempt limit of 8:00, attempts `7:00` and `7:30` → cap is `5:30`, not `8:00`.
- Exhaustion at exactly 0 remaining, and past 0.
- `attemptsLeft` with a cutoff failed, with a cutoff passed, and with a competitor not
  registered for one event of a multi-event group.
- Upper-bound behaviour with one, several, and zero unknown DNF elapsed times.
- Truncation of a `10:00.47` entry to `10:00`, and its effect on the budget.
