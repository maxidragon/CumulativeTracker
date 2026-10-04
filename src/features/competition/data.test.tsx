import type { Competition } from "@wca/helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storageKeys, writeJson } from "../../lib/storage";
import { cacheAge, storedCompetitionName, useCompetitionData } from "./data";

const wcif = {
  id: "InventedOpen2026",
  name: "Invented Open 2026",
  events: [],
  persons: [],
} as unknown as Competition;

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("competition data", () => {
  it("falls back to a labelled WCIF cache when the network fails", async () => {
    writeJson(storageKeys.wcif(wcif.id), {
      wcif,
      fetchedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCompetitionData(wcif.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ wcif, fromCache: true });
  });

  it("formats cache age for people rather than machines", () => {
    const fetchedAt = "2026-01-01T00:00:00.000Z";
    expect(cacheAge(fetchedAt, Date.parse("2026-01-01T00:42:00.000Z"))).toBe(
      "42 minutes old",
    );
    expect(cacheAge(fetchedAt, Date.parse("2026-01-01T02:00:00.000Z"))).toBe(
      "2 hours old",
    );
  });

  it("names a stored competition from the cached WCIF, falling back to its id", () => {
    expect(storedCompetitionName(wcif.id)).toBe(wcif.id);
    writeJson(storageKeys.wcif(wcif.id), { wcif, fetchedAt: "2026-01-01T00:00:00.000Z" });
    expect(storedCompetitionName(wcif.id)).toBe("Invented Open 2026");
  });
});
