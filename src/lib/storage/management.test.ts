import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllStoredData,
  createSafeDataExport,
  listStoredData,
  storageKeys,
} from ".";

describe("stored data management", () => {
  beforeEach(() => localStorage.clear());

  it("lists only application-owned storage", () => {
    localStorage.setItem(storageKeys.calculator, JSON.stringify({ attempts: [] }));
    localStorage.setItem(storageKeys.token("InventedOpen2026"), JSON.stringify({ token: "secret" }));
    localStorage.setItem("another-app", "leave me alone");

    expect(listStoredData()).toEqual([
      { key: storageKeys.calculator, kind: "calculator" },
      {
        key: storageKeys.token("InventedOpen2026"),
        kind: "token",
        competitionId: "InventedOpen2026",
      },
    ]);
  });

  it("never exports OAuth sessions or scoretaking tokens", () => {
    localStorage.setItem(storageKeys.session, JSON.stringify({ accessToken: "oauth-secret" }));
    localStorage.setItem(storageKeys.token("InventedOpen2026"), JSON.stringify({ token: "live-secret" }));
    localStorage.setItem(storageKeys.budgets("InventedOpen2026"), JSON.stringify({ safe: true }));

    const exported = createSafeDataExport(new Date("2026-09-21T12:00:00.000Z"));
    expect(exported.exportedAt).toBe("2026-09-21T12:00:00.000Z");
    expect(exported.data).toEqual({
      [storageKeys.budgets("InventedOpen2026")]: { safe: true },
    });
    expect(JSON.stringify(exported)).not.toContain("secret");
  });

  it("clears every app key and leaves unrelated storage untouched", () => {
    localStorage.setItem(storageKeys.settings, "{}");
    localStorage.setItem(storageKeys.wcif("InventedOpen2026"), "{}");
    localStorage.setItem("another-app", "keep");

    expect(clearAllStoredData()).toBe(2);
    expect(localStorage.getItem(storageKeys.settings)).toBeNull();
    expect(localStorage.getItem("another-app")).toBe("keep");
  });
});
