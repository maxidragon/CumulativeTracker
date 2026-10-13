import type { TrackedAttempt } from "../attempt";
import {
  attemptsForFormat,
  groupKey,
  type Budget,
  type RoundFormat,
  type RoundPlan,
} from "../cumulative";
import type { Competition, Competitor, EventId, Round } from "./types";

const UNSUPPORTED_EVENT_IDS = new Set<EventId>(["333fm", "333mbf", "333mbo"]);
const EVENT_NAMES: Record<EventId, string> = {
  "222": "2x2x2 Cube",
  "333": "3x3x3 Cube",
  "444": "4x4x4 Cube",
  "555": "5x5x5 Cube",
  "666": "6x6x6 Cube",
  "777": "7x7x7 Cube",
  "333bf": "3x3x3 Blindfolded",
  "333fm": "3x3x3 Fewest Moves",
  "333oh": "3x3x3 One-Handed",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  "444bf": "4x4x4 Blindfolded",
  "555bf": "5x5x5 Blindfolded",
  "333mbf": "3x3x3 Multi-Blind",
  fto: "Face-Turning Octahedron",
  magic: "Magic",
  mmagic: "Master Magic",
  "333mbo": "3x3x3 Multi-Blind (old style)",
  "333ft": "3x3x3 With Feet",
};

/** Names for where the full event name does not fit, such as a field label. */
const EVENT_SHORT_NAMES: Partial<Record<string, string>> = {
  "222": "2x2",
  "333": "3x3",
  "444": "4x4",
  "555": "5x5",
  "666": "6x6",
  "777": "7x7",
  "333bf": "3x3 BLD",
  "333fm": "3x3 FM",
  "333oh": "3x3 OH",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "SQ1",
  "444bf": "4x4 BLD",
  "555bf": "5x5 BLD",
  "333mbf": "3x3 MBLD",
  fto: "FTO",
};

export type CompetitionRound = RoundPlan & {
  eventName: string;
  eventShortName: string;
  roundNumber: number;
  /** "First round", "Second round", …, "Final", as WCA Live names rounds. */
  roundLabel: string;
};

export type UnsupportedRound = {
  roundId: string;
  eventId: EventId;
};

/** A round the tracker can budget: a timed event and a fixed number of attempts. */
type SupportedRound = Round & { format: RoundFormat };

function isSupportedRound(eventId: EventId, round: Round): round is SupportedRound {
  return !UNSUPPORTED_EVENT_IDS.has(eventId) && round.format !== "h";
}

export type CompetitionGroup = {
  key: string;
  limitCentiseconds: number;
  cumulative: boolean;
  rounds: CompetitionRound[];
};

function roundNumber(roundId: string): number {
  const match = roundId.match(/-r(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function roundLabel(number: number, roundCount: number): string {
  if (number === roundCount) return "Final";
  return ["First round", "Second round", "Third round"][number - 1] ?? `Round ${number}`;
}

function toCompetitionRound(
  eventId: EventId,
  round: SupportedRound,
  roundCount: number,
): CompetitionRound {
  const number = roundNumber(round.id);
  return {
    roundId: round.id,
    eventId,
    eventName: EVENT_NAMES[eventId],
    eventShortName: EVENT_SHORT_NAMES[eventId] ?? EVENT_NAMES[eventId],
    roundNumber: number,
    roundLabel: roundLabel(number, roundCount),
    format: round.format,
    cutoff:
      round.cutoff && round.cutoff.resultValue > 0
        ? {
            numberOfAttempts: round.cutoff.numberOfAttempts,
            attemptResult: round.cutoff.resultValue,
          }
        : null,
    registered: true,
  };
}

export function extractCompetitionGroups(wcif: Competition): CompetitionGroup[] {
  const roundsById = new Map<string, { eventId: EventId; round: Round; roundCount: number }>();
  for (const event of wcif.events) {
    for (const round of event.rounds) {
      roundsById.set(round.id, { eventId: event.id, round, roundCount: event.rounds.length });
    }
  }

  const groups = new Map<string, CompetitionGroup>();
  for (const event of wcif.events) {
    for (const round of event.rounds) {
      if (!isSupportedRound(event.id, round)) continue;
      const timeLimit = round.timeLimit;
      if (!timeLimit || timeLimit.centiseconds <= 0) continue;

      const cumulativeRoundIds = timeLimit.cumulativeRoundIds;
      const roundIds = cumulativeRoundIds.length > 0 ? cumulativeRoundIds : [round.id];
      const key = groupKey(roundIds);
      if (groups.has(key)) continue;

      const members = roundIds.flatMap((roundId) => roundsById.get(roundId) ?? []);
      const rounds = members.flatMap(({ eventId, round, roundCount }) =>
        isSupportedRound(eventId, round) ? [toCompetitionRound(eventId, round, roundCount)] : [],
      );
      // A shared limit cannot be budgeted when one of its rounds has no fixed attempt count.
      if (rounds.length === 0 || rounds.length < members.length) continue;

      groups.set(key, {
        key,
        limitCentiseconds: timeLimit.centiseconds,
        cumulative: cumulativeRoundIds.length > 0,
        rounds,
      });
    }
  }

  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function unsupportedRounds(wcif: Competition): UnsupportedRound[] {
  return wcif.events.flatMap((event) =>
    event.rounds
      .filter((round) => !isSupportedRound(event.id, round))
      .map((round) => ({ roundId: round.id, eventId: event.id })),
  );
}

export function competitorsForGroup(
  wcif: Competition,
  group: CompetitionGroup,
): Competitor[] {
  const eventIds = new Set(group.rounds.map(({ eventId }) => eventId));
  return wcif.persons
    .filter(
      (person): person is Competitor =>
        person.registrantId !== null &&
        person.registration?.status === "accepted" &&
        person.registration.isCompeting &&
        person.registration.eventIds.some((eventId) => eventIds.has(eventId)),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function plansForCompetitor(
  person: Competitor,
  group: CompetitionGroup,
): RoundPlan[] {
  const registeredEvents = new Set(person.registration?.eventIds ?? []);
  return group.rounds.map((round) => ({
    roundId: round.roundId,
    eventId: round.eventId,
    format: round.format,
    cutoff: round.cutoff,
    registered: registeredEvents.has(round.eventId as EventId),
  }));
}

export function createCompetitionBudget(
  person: Competitor,
  group: CompetitionGroup,
  perAttemptLimitCentiseconds: number | null = null,
): Budget {
  const registeredEvents = new Set(person.registration?.eventIds ?? []);
  let order = 0;
  const attempts: TrackedAttempt[] = group.rounds.flatMap((round) =>
    registeredEvents.has(round.eventId as EventId)
      ? Array.from({ length: attemptsForFormat(round.format) }, (_, index) => ({
          roundId: round.roundId,
          attemptNumber: index + 1,
          outcome: "skipped" as const,
          centiseconds: null,
          estimated: false,
          order: ++order,
          enteredAt: "",
        }))
      : [],
  );

  return {
    groupKey: group.key,
    limitCentiseconds: group.limitCentiseconds,
    perAttemptLimitCentiseconds,
    registrantId: person.registrantId,
    attempts,
  };
}

export function groupTitle(group: CompetitionGroup): string {
  return group.rounds
    .map(({ eventName, roundLabel }) => `${eventName} · ${roundLabel}`)
    .join(" + ");
}

