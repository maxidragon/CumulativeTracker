import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicWcif, WcaApiError } from "./client";

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
});
