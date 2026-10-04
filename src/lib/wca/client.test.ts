import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicWcif, searchCompetitions, WcaApiError } from "./client";

const minimalWcif = {
  id: "InventedOpen2026",
  name: "Invented Open 2026",
  events: [],
  persons: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("WCA client", () => {
  it("loads the public WCIF without credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(minimalWcif), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicWcif("InventedOpen2026")).resolves.toMatchObject(minimalWcif);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.worldcubeassociation.org/api/v0/competitions/InventedOpen2026/wcif/public",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("maps a missing competition to an actionable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404, statusText: "Not Found" })),
    );
    await expect(fetchPublicWcif("MissingOpen2026")).rejects.toEqual(
      new WcaApiError("Could not load MissingOpen2026: Competition not found.", 404),
    );
  });

  it("rejects an unexpected response shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "not a WCIF" }), { status: 200 }),
      ),
    );
    await expect(fetchPublicWcif("InventedOpen2026")).rejects.toThrow(
      /unexpected response/i,
    );
  });

  it("searches competitions by name, newest first", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "InventedOpen2026",
            name: "Invented Open 2026",
            city: "Exampleville",
            country_iso2: "XA",
            start_date: "2026-05-02",
            end_date: "2026-05-03",
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchCompetitions("invented")).resolves.toEqual([
      {
        id: "InventedOpen2026",
        name: "Invented Open 2026",
        city: "Exampleville",
        countryIso2: "XA",
        startDate: "2026-05-02",
        endDate: "2026-05-03",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.worldcubeassociation.org/api/v0/competitions?q=invented&sort=-start_date&per_page=10",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("rejects an unexpected search response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 1 }]), { status: 200 })),
    );
    await expect(searchCompetitions("invented")).rejects.toThrow(/unexpected response/i);
  });
});
