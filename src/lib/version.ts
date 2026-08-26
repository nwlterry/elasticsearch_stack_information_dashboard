export const DASHBOARD_VERSION = "1.0.0";
export const MIN_ES_VERSION = "8.14.0";
export const VERIFIED_ES_VERSION = "8.18.4";

export function parseVersion(raw: string | undefined): string {
  if (!raw) return "unknown";
  return raw.trim().replace(/^v/i, "").split("-")[0] ?? "unknown";
}

export function compareSemver(a: string, b: string): number {
  const left = parseVersion(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const right = parseVersion(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (left[i] ?? 0) - (right[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function isSupportedEsVersion(raw: string | undefined): boolean {
  const version = parseVersion(raw);
  if (version === "unknown") return false;
  return compareSemver(version, MIN_ES_VERSION) >= 0;
}

export function versionWarning(raw: string | undefined): string | null {
  if (isSupportedEsVersion(raw)) return null;
  const version = parseVersion(raw);
  return `This dashboard is built for Elasticsearch ${MIN_ES_VERSION} and later (internal collection .monitoring-es-* and Elastic Agent metrics-elasticsearch.stack_monitoring.index-*). Detected ${version}. Queries may still run, but field aliases and Agent data streams are not guaranteed.`;
}
