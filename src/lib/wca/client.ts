import type { Competition } from "@wca/helpers";

const DEFAULT_WCA_ORIGIN = "https://www.worldcubeassociation.org";
const KNOWN_EVENT_IDS = new Set([
  "222",
  "333",
  "444",
  "555",
  "666",
  "777",
  "333bf",
  "333fm",
  "333oh",
  "clock",
  "minx",
  "pyram",
  "skewb",
  "sq1",
  "444bf",
  "555bf",
  "333mbf",
  "magic",
  "mmagic",
  "333mbo",
  "333ft",
]);

export class WcaApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "WcaApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeLimit(value: unknown): boolean {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.centiseconds) &&
    Array.isArray(value.cumulativeRoundIds) &&
    value.cumulativeRoundIds.every((roundId) => typeof roundId === "string")
  );
}

function isRound(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    ["1", "2", "3", "5", "a", "m"].includes(String(value.format)) &&
    (value.timeLimit === null || isTimeLimit(value.timeLimit)) &&
    (value.cutoff === null ||
      (isRecord(value.cutoff) &&
        Number.isInteger(value.cutoff.numberOfAttempts) &&
        typeof value.cutoff.attemptResult === "number"))
  );
}

function isEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    KNOWN_EVENT_IDS.has(value.id) &&
    Array.isArray(value.rounds) &&
    value.rounds.every(isRound)
  );
}

function isPerson(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.registrantId) ||
    typeof value.name !== "string" ||
    typeof value.countryIso2 !== "string"
  ) {
    return false;
  }
  const registration = value.registration;
  return (
    registration === null ||
    registration === undefined ||
    (isRecord(registration) &&
      Array.isArray(registration.eventIds) &&
      registration.eventIds.every(
        (eventId) => typeof eventId === "string" && KNOWN_EVENT_IDS.has(eventId),
      ) &&
      ["accepted", "pending", "deleted"].includes(String(registration.status)) &&
      typeof registration.isCompeting === "boolean")
  );
}

export function isCompetition(value: unknown): value is Competition {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.events) &&
    value.events.every(isEvent) &&
    Array.isArray(value.persons) &&
    value.persons.every(isPerson)
  );
}

function wcaOrigin(): string {
  const configuredOrigin: unknown = import.meta.env.VITE_WCA_ORIGIN;
  return (
    typeof configuredOrigin === "string" && configuredOrigin !== ""
      ? configuredOrigin
      : DEFAULT_WCA_ORIGIN
  ).replace(/\/$/, "");
}

export type CompetitionSummary = {
  id: string;
  name: string;
  city: string;
  countryIso2: string;
  startDate: string;
  endDate: string;
};

const COMPETITION_SUMMARY_KEYS = [
  "id",
  "name",
  "city",
  "country_iso2",
  "start_date",
  "end_date",
] as const;

function isCompetitionSummary(
  value: unknown,
): value is Record<(typeof COMPETITION_SUMMARY_KEYS)[number], string> {
  return (
    isRecord(value) && COMPETITION_SUMMARY_KEYS.every((key) => typeof value[key] === "string")
  );
}

/** Parses a WCA competitions index response; null when it has an unexpected shape. */
export function parseCompetitionSummaries(value: unknown): CompetitionSummary[] | null {
  if (!Array.isArray(value) || !value.every(isCompetitionSummary)) return null;
  return value.map((competition) => ({
    id: competition.id,
    name: competition.name,
    city: competition.city,
    countryIso2: competition.country_iso2,
    startDate: competition.start_date,
    endDate: competition.end_date,
  }));
}

export async function searchCompetitions(
  query: string,
  signal?: AbortSignal,
): Promise<CompetitionSummary[]> {
  const params = new URLSearchParams({ q: query, sort: "-start_date", per_page: "10" });
  const response = await fetch(`${wcaOrigin()}/api/v0/competitions?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new WcaApiError(
      `Competition search failed: ${response.statusText || `WCA returned ${response.status}`}`,
      response.status,
    );
  }

  const competitions = parseCompetitionSummaries(await response.json());
  if (!competitions) {
    throw new WcaApiError(
      "Competition search failed: the WCA returned an unexpected response.",
      response.status,
    );
  }
  return competitions;
}

export async function fetchPublicWcif(
  competitionId: string,
  signal?: AbortSignal,
): Promise<Competition> {
  const response = await fetch(
    `${wcaOrigin()}/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif/public`,
    { headers: { Accept: "application/json" }, signal },
  );

  if (!response.ok) {
    const detail = response.status === 404 ? "Competition not found." : response.statusText;
    throw new WcaApiError(
      `Could not load ${competitionId}: ${detail || `WCA returned ${response.status}`}`,
      response.status,
    );
  }

  const value: unknown = await response.json();
  if (!isCompetition(value)) {
    throw new WcaApiError(
      `Could not load ${competitionId}: the WCA returned an unexpected response.`,
      response.status,
    );
  }
  return value;
}
