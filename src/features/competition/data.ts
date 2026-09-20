import type { Competition } from "@wca/helpers";
import { useQuery } from "@tanstack/react-query";
import { readJson, storageKeys, writeJson } from "../../lib/storage";
import { fetchPublicWcif, isCompetition } from "../../lib/wca";

export type CachedWcif = {
  wcif: Competition;
  fetchedAt: string;
};

export type CompetitionData = CachedWcif & {
  fromCache: boolean;
};

export type RecentCompetition = {
  id: string;
  name: string;
  openedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCachedWcif(value: unknown): value is CachedWcif {
  return (
    isRecord(value) &&
    typeof value.fetchedAt === "string" &&
    isCompetition(value.wcif)
  );
}

function isRecentCompetitions(value: unknown): value is RecentCompetition[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.openedAt === "string",
    )
  );
}

export function readRecentCompetitions(): RecentCompetition[] {
  return readJson(storageKeys.recentCompetitions, isRecentCompetitions) ?? [];
}

export function rememberCompetition(wcif: Competition): void {
  const recent = readRecentCompetitions().filter(({ id }) => id !== wcif.id);
  writeJson(storageKeys.recentCompetitions, [
    { id: wcif.id, name: wcif.name, openedAt: new Date().toISOString() },
    ...recent,
  ].slice(0, 8));
}

export function useCompetitionData(competitionId: string) {
  return useQuery({
    queryKey: ["wcif", competitionId],
    queryFn: async ({ signal }): Promise<CompetitionData> => {
      const cached = readJson(storageKeys.wcif(competitionId), isCachedWcif);
      try {
        const wcif = await fetchPublicWcif(competitionId, signal);
        const fetchedAt = new Date().toISOString();
        writeJson(storageKeys.wcif(competitionId), { wcif, fetchedAt });
        rememberCompetition(wcif);
        return { wcif, fetchedAt, fromCache: false };
      } catch (error) {
        if (cached) return { ...cached, fromCache: true };
        throw error;
      }
    },
    enabled: competitionId !== "",
    retry: false,
  });
}

export function cacheAge(fetchedAt: string, now = Date.now()): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(fetchedAt).getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return "less than a minute old";
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} old`;
  const hours = Math.floor(elapsedMinutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} old`;
}
