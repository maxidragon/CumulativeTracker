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

export async function fetchPublicWcif(
  competitionId: string,
  signal?: AbortSignal,
): Promise<Competition> {
  const configuredOrigin: unknown = import.meta.env.VITE_WCA_ORIGIN;
  const origin = (
    typeof configuredOrigin === "string" && configuredOrigin !== ""
      ? configuredOrigin
      : DEFAULT_WCA_ORIGIN
  ).replace(/\/$/, "");
  const response = await fetch(
    `${origin}/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif/public`,
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
