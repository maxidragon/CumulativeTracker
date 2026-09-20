import { create } from "zustand";
import { readJson, storageKeys, writeJson } from "../../lib/storage";

export type ThemePreference = "system" | "light" | "dark";

export type AppSettings = {
  version: 1;
  theme: ThemePreference;
};

type SettingsStore = {
  settings: AppSettings;
  resetSettings: () => void;
  setTheme: (theme: ThemePreference) => void;
};

export const defaultSettings: AppSettings = { version: 1, theme: "system" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAppSettings(value: unknown): value is AppSettings {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.theme === "system" || value.theme === "light" || value.theme === "dark")
  );
}

function persist(settings: AppSettings): AppSettings {
  writeJson(storageKeys.settings, settings);
  return settings;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: readJson(storageKeys.settings, isAppSettings) ?? defaultSettings,
  resetSettings: () => set({ settings: defaultSettings }),
  setTheme: (theme) => set({ settings: persist({ version: 1, theme }) }),
}));
