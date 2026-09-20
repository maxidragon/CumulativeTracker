import { beforeEach, describe, expect, it } from "vitest";
import { storageKeys } from "../../lib/storage";
import { defaultSettings, isAppSettings, useSettingsStore } from "./store";

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ settings: defaultSettings });
  });

  it("validates the versioned theme preference", () => {
    expect(isAppSettings({ version: 1, theme: "system" })).toBe(true);
    expect(isAppSettings({ version: 1, theme: "sepia" })).toBe(false);
    expect(isAppSettings({ theme: "dark" })).toBe(false);
  });

  it("persists an explicit override and can reset its in-memory value", () => {
    useSettingsStore.getState().setTheme("dark");
    expect(JSON.parse(localStorage.getItem(storageKeys.settings) ?? "null")).toEqual({
      version: 1,
      theme: "dark",
    });
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
  });
});
