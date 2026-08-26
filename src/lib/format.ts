const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function formatBytes(value: number, digits = 1): string {
  const sign = value < 0 ? "-" : "";
  let abs = Math.abs(value);
  let unit = 0;
  while (abs >= 1024 && unit < BYTE_UNITS.length - 1) {
    abs /= 1024;
    unit += 1;
  }
  const precision = unit === 0 || abs >= 100 ? 0 : abs >= 10 ? 1 : digits;
  return `${sign}${abs.toFixed(precision)} ${BYTE_UNITS[unit]}`;
}

export function formatDocs(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1000) return `${sign}${Math.round(abs)}`;
  if (abs < 1_000_000) return `${sign}${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  if (abs < 1_000_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function dateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function weekdayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}
