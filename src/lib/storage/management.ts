const STORAGE_PREFIX = "ct:v1:";

export type StoredDataKind =
  | "calculator"
  | "competition"
  | "session"
  | "settings"
  | "token"
  | "other";

export type StoredDataItem = {
  key: string;
  kind: StoredDataKind;
  competitionId?: string;
};

function kindForKey(key: string): Pick<StoredDataItem, "kind" | "competitionId"> {
  if (key === "ct:v1:calculator") return { kind: "calculator" };
  if (key === "ct:v1:session") return { kind: "session" };
  if (key === "ct:v1:settings") return { kind: "settings" };
  if (key.startsWith("ct:v1:token:")) {
    return { kind: "token", competitionId: key.slice("ct:v1:token:".length) };
  }
  if (key.startsWith("ct:v1:wcif:") || key.startsWith("ct:v1:budgets:")) {
    const separator = key.lastIndexOf(":");
    return { kind: "competition", competitionId: key.slice(separator + 1) };
  }
  if (key === "ct:v1:recent") return { kind: "competition" };
  return { kind: "other" };
}

export function listStoredData(): StoredDataItem[] {
  try {
    const items: StoredDataItem[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) items.push({ key, ...kindForKey(key) });
    }
    return items.sort((left, right) => left.key.localeCompare(right.key));
  } catch {
    return [];
  }
}

export function clearAllStoredData(): number {
  const items = listStoredData();
  for (const { key } of items) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Continue clearing the remaining entries if storage becomes unavailable.
    }
  }
  return items.length;
}

export type SafeDataExport = {
  application: "Cumulative Tracker";
  schemaVersion: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};

function isSensitiveKey(key: string): boolean {
  return key === "ct:v1:session" || key.startsWith("ct:v1:token:");
}

export function createSafeDataExport(now = new Date()): SafeDataExport {
  const data: Record<string, unknown> = {};
  for (const { key } of listStoredData()) {
    if (isSensitiveKey(key)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = JSON.parse(raw) as unknown;
    } catch {
      // Invalid or inaccessible data is omitted from the recovery export.
    }
  }
  return {
    application: "Cumulative Tracker",
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    data,
  };
}

export function downloadSafeDataExport(): void {
  const contents = JSON.stringify(createSafeDataExport(), null, 2);
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `cumulative-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
