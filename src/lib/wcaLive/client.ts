const DEFAULT_WCA_LIVE_ORIGIN = "https://live.worldcubeassociation.org";

export type LiveRoundResult = {
  personId: number;
  attempts: number[];
};

export type LiveRound = {
  number: number;
  results: LiveRoundResult[];
};

export type LiveEvent = {
  eventId: string;
  rounds: LiveRound[];
};

export type LiveResults = {
  events: LiveEvent[];
};

export type EnterAttemptPayload = {
  competitionWcaId: string;
  eventId: string;
  roundNumber: number;
  registrantId: number;
  attemptNumber: number;
  attemptResult: number;
};

export class WcaLiveError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "WcaLiveError";
  }
}

function origin(): string {
  const configured: unknown = import.meta.env.VITE_WCA_LIVE_ORIGIN;
  return (
    typeof configured === "string" && configured !== ""
      ? configured
      : DEFAULT_WCA_LIVE_ORIGIN
  ).replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLiveResults(value: unknown): value is LiveResults {
  return (
    isRecord(value) &&
    Array.isArray(value.events) &&
    value.events.every(
      (event) =>
        isRecord(event) &&
        typeof event.eventId === "string" &&
        Array.isArray(event.rounds) &&
        event.rounds.every(
          (round) =>
            isRecord(round) &&
            Number.isInteger(round.number) &&
            Array.isArray(round.results) &&
            round.results.every(
              (result) =>
                isRecord(result) &&
                Number.isInteger(result.personId) &&
                Array.isArray(result.attempts) &&
                result.attempts.every((attempt) => Number.isInteger(attempt)),
            ),
        ),
    )
  );
}

export async function fetchLiveResults(
  competitionId: string,
  signal?: AbortSignal,
): Promise<LiveResults> {
  const response = await fetch(
    `${origin()}/api/competitions/${encodeURIComponent(competitionId)}/results`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!response.ok) {
    throw new WcaLiveError(
      `WCA Live results could not be loaded (status ${response.status}).`,
      response.status,
    );
  }
  const value: unknown = await response.json();
  if (!isLiveResults(value)) {
    throw new WcaLiveError("WCA Live returned an unexpected results response.", response.status);
  }
  return value;
}

async function responseMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return "";
  try {
    const value: unknown = JSON.parse(text);
    if (isRecord(value)) {
      if (typeof value.error === "string") return value.error;
      if (typeof value.message === "string") return value.message;
      if (Array.isArray(value.errors)) return value.errors.map(String).join("; ");
    }
  } catch {
    return text;
  }
  return text;
}

function mappedSubmissionError(status: number, detail: string): string {
  const suffix = detail ? ` ${detail}` : "";
  if (status === 400) {
    return `WCA Live rejected an invalid request. This is an internal error; please report it.${suffix}`;
  }
  if (status === 401) {
    return `WCA Live rejected the scoretaking token.${suffix} Re-generate the token on WCA Live for this competition.`;
  }
  if (status === 404) {
    return `WCA Live could not find the competition, round, or competitor.${suffix} Check that the round is open and the competitor is in it.`;
  }
  if (status === 422) {
    return `WCA Live could not accept this attempt.${suffix}`;
  }
  return `WCA Live submission failed with status ${status}.${suffix}`;
}

export async function enterLiveAttempt(
  token: string,
  payload: EnterAttemptPayload,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${origin()}/api/enter-attempt`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (response.status === 200) return;
  throw new WcaLiveError(
    mappedSubmissionError(response.status, await responseMessage(response)),
    response.status,
  );
}
