import type {
  DailyIngestPoint,
  FamilyBytes,
  IndexDaySnapshot,
  IndexIngestRow,
  StreamFamily,
} from "./types";
import { STREAM_FAMILIES } from "./types";
import { addUtcDays } from "./format";

const EMPTY_FAMILY: FamilyBytes = {
  logs: 0,
  metrics: 0,
  kafka: 0,
  apm: 0,
  system: 0,
  other: 0,
};

export function classifyFamily(indexName: string): StreamFamily {
  const n = indexName.toLowerCase();
  if (
    n.includes(".monitoring") ||
    n.includes("stack_monitoring") ||
    n.includes(".kibana") ||
    n.includes(".security") ||
    n.includes(".watcher") ||
    n.includes(".tasks") ||
    n.includes(".async-search") ||
    n.includes(".fleet") ||
    n.includes("elastic_agent")
  ) {
    return "system";
  }
  if (n.includes("apm") || n.includes("traces-") || n.includes("span") || n.includes("transaction")) {
    return "apm";
  }
  if (n.includes("kafka") || n.includes("connect")) {
    return "kafka";
  }
  if (
    n.includes("metric") ||
    n.includes("prometheus") ||
    n.includes("prom-") ||
    n.includes("vsphere")
  ) {
    return "metrics";
  }
  if (
    n.includes("logs-") ||
    n.includes("filebeat") ||
    n.includes("winlog") ||
    n.includes("syslog") ||
    n.includes("fluent") ||
    n.includes("vector") ||
    n.includes("iis") ||
    n.includes("openshift") ||
    n.includes("audit")
  ) {
    return "logs";
  }
  return "other";
}

export function emptyFamily(): FamilyBytes {
  return { ...EMPTY_FAMILY };
}

export function familyTotal(f: FamilyBytes): number {
  return STREAM_FAMILIES.reduce((sum, key) => sum + f[key], 0);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((acc, x) => acc + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

export function rollupSnapshots(
  snapshots: IndexDaySnapshot[],
  rangeEnd: string,
  rangeDays: number,
): { daily: DailyIngestPoint[]; indices: IndexIngestRow[] } {
  const start = addUtcDays(rangeEnd, -(rangeDays - 1));
  const byIndex = new Map<string, IndexDaySnapshot[]>();
  for (const row of snapshots) {
    const list = byIndex.get(row.index) ?? [];
    list.push(row);
    byIndex.set(row.index, list);
  }

  const dailyMap = new Map<string, DailyIngestPoint>();
  const ensureDay = (date: string, timestamp: number): DailyIngestPoint => {
    let point = dailyMap.get(date);
    if (!point) {
      point = {
        date,
        timestamp,
        bytes: 0,
        docs: 0,
        byFamily: emptyFamily(),
        anomaly: false,
      };
      dailyMap.set(date, point);
    }
    return point;
  };

  // Pre-create every day in range so the chart has no gaps.
  for (let i = 0; i < rangeDays; i += 1) {
    const date = addUtcDays(start, i);
    ensureDay(date, Date.parse(`${date}T00:00:00.000Z`));
  }

  const indices: IndexIngestRow[] = [];

  for (const [name, rows] of byIndex) {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const family = classifyFamily(name);
    const sparkline: number[] = [];
    let bytesPeriod = 0;
    let docsPeriod = 0;
    let bytesToday = 0;
    let currentStore = 0;

    for (let i = 0; i < sorted.length; i += 1) {
      const cur = sorted[i];
      const prev = i > 0 ? sorted[i - 1] : undefined;
      const ingestBytes = Math.max(0, cur.sizeBytes - (prev?.sizeBytes ?? 0));
      const ingestDocs = Math.max(0, cur.docs - (prev?.docs ?? 0));
      currentStore = cur.sizeBytes;

      if (cur.date >= start && cur.date <= rangeEnd) {
        const point = ensureDay(cur.date, cur.timestamp);
        point.bytes += ingestBytes;
        point.docs += ingestDocs;
        point.byFamily[family] += ingestBytes;
        bytesPeriod += ingestBytes;
        docsPeriod += ingestDocs;
        if (cur.date === rangeEnd) bytesToday = ingestBytes;
        sparkline.push(ingestBytes);
      }
    }

    if (bytesPeriod <= 0 && currentStore <= 0) continue;

    const last = sorted[sorted.length - 1];
    const ilmPhase: IndexIngestRow["ilmPhase"] =
      family === "apm" && last && last.date < addUtcDays(rangeEnd, -14)
        ? "cold"
        : family === "system"
          ? "hot"
          : last && last.date < addUtcDays(rangeEnd, -7)
            ? "warm"
            : "hot";

    indices.push({
      name,
      family,
      ilmPhase,
      bytesToday,
      bytesPeriod,
      docsPeriod,
      currentStoreBytes: currentStore,
      sparkline: sparkline.slice(-14),
      pri: family === "system" ? 1 : family === "apm" ? 3 : 2,
    });
  }

  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totals = daily.map((d) => d.bytes);
  const m = mean(totals);
  const sd = stddev(totals);
  if (sd > 0) {
    for (const point of daily) {
      point.anomaly = (point.bytes - m) / sd >= 2;
    }
  }

  indices.sort((a, b) => b.bytesPeriod - a.bytesPeriod);
  return { daily, indices };
}

export function periodStats(daily: DailyIngestPoint[]) {
  const last = daily[daily.length - 1];
  const prev = daily[daily.length - 2];
  const bytes = daily.map((d) => d.bytes);
  const total = bytes.reduce((a, b) => a + b, 0);
  const avg = daily.length ? total / daily.length : 0;
  let peak = daily[0];
  for (const d of daily) {
    if (!peak || d.bytes > peak.bytes) peak = d;
  }
  const half = Math.floor(daily.length / 2);
  const recent = daily.slice(half);
  const older = daily.slice(0, half);
  const recentAvg = recent.length ? recent.reduce((a, b) => a + b.bytes, 0) / recent.length : 0;
  const olderAvg = older.length ? older.reduce((a, b) => a + b.bytes, 0) / older.length : 0;
  const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  const vsYesterday = prev && prev.bytes > 0 ? ((last?.bytes ?? 0) - prev.bytes) / prev.bytes * 100 : 0;
  const last7 = daily.slice(-7);
  const avg7 = last7.length ? last7.reduce((a, b) => a + b.bytes, 0) / last7.length : 0;
  const familyTotals = emptyFamily();
  for (const d of daily) {
    for (const key of STREAM_FAMILIES) familyTotals[key] += d.byFamily[key];
  }
  return {
    today: last?.bytes ?? 0,
    todayDocs: last?.docs ?? 0,
    yesterday: prev?.bytes ?? 0,
    vsYesterday,
    avg7,
    periodTotal: total,
    periodDocs: daily.reduce((a, b) => a + b.docs, 0),
    peak,
    trendPct,
    avg,
    familyTotals,
  };
}

export function filterFamilies(
  daily: DailyIngestPoint[],
  hidden: ReadonlySet<StreamFamily>,
): DailyIngestPoint[] {
  if (hidden.size === 0) return daily;
  return daily.map((d) => {
    const byFamily = emptyFamily();
    let bytes = 0;
    for (const key of STREAM_FAMILIES) {
      if (hidden.has(key)) continue;
      byFamily[key] = d.byFamily[key];
      bytes += d.byFamily[key];
    }
    return { ...d, byFamily, bytes };
  });
}
