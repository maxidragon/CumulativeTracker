/**
 * The part of WCIF v2 (https://github.com/thewca/wcif/blob/latest/specification.md) this app
 * reads. `@wca/helpers` still describes v1, so the types live here.
 */

export type EventId =
  | "222"
  | "333"
  | "444"
  | "555"
  | "666"
  | "777"
  | "333bf"
  | "333fm"
  | "333oh"
  | "clock"
  | "minx"
  | "pyram"
  | "skewb"
  | "sq1"
  | "444bf"
  | "555bf"
  | "333mbf"
  | "fto"
  | "magic"
  | "mmagic"
  | "333mbo"
  | "333ft";

/** `h` is Head-to-Head, which has no fixed number of attempts. */
export type WcifRoundFormat = "1" | "2" | "3" | "5" | "a" | "m" | "h";

export type TimeLimit = {
  centiseconds: number;
  /** Empty when the limit applies to each attempt separately. */
  cumulativeRoundIds: string[];
};

export type Cutoff = {
  numberOfAttempts: number;
  resultValue: number;
};

export type Round = {
  id: string;
  /** The rounds of a Dual Round (regulation 9v), this one included; null otherwise. */
  linkedRounds?: string[] | null;
  format: WcifRoundFormat;
  timeLimit: TimeLimit | null;
  cutoff: Cutoff | null;
};

export type Event = {
  id: EventId;
  rounds: Round[];
};

export type Registration = {
  eventIds: EventId[];
  status: "accepted" | "pending" | "deleted";
  isCompeting: boolean;
};

export type Person = {
  /** Null for staff who did not register, although the specification says Integer. */
  registrantId: number | null;
  name: string;
  wcaUserId: number;
  countryIso2: string;
  roles?: string[];
  registration: Registration | null;
};

/** A person competing at the competition, so with a registration and a registrant id. */
export type Competitor = Person & { registrantId: number; registration: Registration };

export type Competition = {
  formatVersion: string;
  id: string;
  name: string;
  persons: Person[];
  events: Event[];
};
