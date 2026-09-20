import { useQuery } from "@tanstack/react-query";
import type { Competition, Person } from "@wca/helpers";
import type { AuthSession } from "./model";
import { useAuthStore } from "./store";

const DEFAULT_WCA_ORIGIN = "https://www.worldcubeassociation.org";

export type CurrentUser = {
  id: number;
  name: string;
  wcaId: string | null;
};

export type ManagedCompetition = {
  id: string;
  name: string;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function wcaOrigin(): string {
  const configured: unknown = import.meta.env.VITE_WCA_ORIGIN;
  return (
    typeof configured === "string" && configured !== "" ? configured : DEFAULT_WCA_ORIGIN
  ).replace(/\/$/, "");
}

async function authenticatedJson(
  path: string,
  session: AuthSession,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`${wcaOrigin()}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${session.accessToken}` },
    signal,
  });
  if (!response.ok) {
    throw new AuthApiError(
      response.status === 401
        ? "Your WCA sign-in is no longer valid. Please sign in again."
        : `The WCA request failed with status ${response.status}.`,
      response.status,
    );
  }
  return response.json() as Promise<unknown>;
}

export async function fetchCurrentUser(
  session: AuthSession,
  signal?: AbortSignal,
): Promise<CurrentUser> {
  const value = await authenticatedJson("/api/v0/me", session, signal);
  const me = isRecord(value) && isRecord(value.me) ? value.me : value;
  if (!isRecord(me) || !Number.isInteger(me.id) || typeof me.name !== "string") {
    throw new AuthApiError("The WCA returned an unexpected user response.", 200);
  }
  return {
    id: me.id as number,
    name: me.name,
    wcaId: typeof me.wca_id === "string" ? me.wca_id : null,
  };
}

export async function fetchManagedCompetitions(
  session: AuthSession,
  signal?: AbortSignal,
): Promise<ManagedCompetition[]> {
  const value = await authenticatedJson(
    "/api/v0/competitions?managed_by_me=true",
    session,
    signal,
  );
  if (
    !Array.isArray(value) ||
    !value.every(
      (competition) =>
        isRecord(competition) &&
        typeof competition.id === "string" &&
        typeof competition.name === "string",
    )
  ) {
    throw new AuthApiError("The WCA returned an unexpected competitions response.", 200);
  }
  return value.map((competition) => ({
    id: String((competition as Record<string, unknown>).id),
    name: String((competition as Record<string, unknown>).name),
  }));
}

export function useCurrentUser() {
  const session = useAuthStore((state) => state.session);
  return useQuery({
    queryKey: ["auth", "me", session?.accessToken],
    queryFn: ({ signal }) => {
      if (!session) throw new Error("WCA sign-in is required.");
      return fetchCurrentUser(session, signal);
    },
    enabled: session !== null,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useManagedCompetitions() {
  const session = useAuthStore((state) => state.session);
  return useQuery({
    queryKey: ["auth", "managed-competitions", session?.accessToken],
    queryFn: ({ signal }) => {
      if (!session) throw new Error("WCA sign-in is required.");
      return fetchManagedCompetitions(session, signal);
    },
    enabled: session !== null,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function hasCompetitionPermissionHint(
  user: CurrentUser,
  competition: Competition,
  managedCompetitions: ManagedCompetition[],
): boolean {
  if (managedCompetitions.some(({ id }) => id === competition.id)) return true;
  return competition.persons.some(
    (person: Person) =>
      person.wcaUserId === user.id &&
      person.roles?.some((role) =>
        ["delegate", "trainee-delegate", "organizer"].includes(role),
      ),
  );
}
