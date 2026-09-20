export function readJson<T>(key: string, validate: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (validate(value)) return value;
    removeStoredValue(key);
    return null;
  } catch {
    removeStoredValue(key);
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full. The in-memory state remains usable.
  }
}

export function removeStoredValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Treat unavailable storage as already empty.
  }
}
