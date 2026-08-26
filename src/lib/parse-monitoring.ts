import type { IndexDaySnapshot, MonitoringDataset } from "./types";
import { utcToday } from "./format";
import { rollupSnapshots } from "./ingest";
import { isSupportedEsVersion, parseVersion, versionWarning } from "./version";

interface AggBucket {
  key?: string | number;
  key_as_string?: string;
  max_size?: { value?: number | null };
  max_docs?: { value?: number | null };
  peak_size?: { value?: number | null };
  by_day?: { buckets?: AggBucket[] };
}

interface EsAggResponse {
  aggregations?: {
    indices?: { buckets?: AggBucket[] };
    by_day?: { buckets?: AggBucket[] };
  };
  hits?: { hits?: Array<{ _source?: Record<string, unknown> }> };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function bucketDate(bucket: AggBucket): string | null {
  if (typeof bucket.key_as_string === "string" && bucket.key_as_string.length >= 10) {
    return bucket.key_as_string.slice(0, 10);
  }
  if (typeof bucket.key === "number") {
    return new Date(bucket.key).toISOString().slice(0, 10);
  }
  if (typeof bucket.key === "string" && bucket.key.length >= 10) {
    return bucket.key.slice(0, 10);
  }
  return null;
}

function num(value: { value?: number | null } | undefined): number {
  const n = value?.value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function extractSnapshots(payload: unknown): IndexDaySnapshot[] {
  if (!isRecord(payload)) throw new Error("Response is not a JSON object.");
  const body = payload as EsAggResponse;
  const indexBuckets = body.aggregations?.indices?.buckets;
  const snapshots: IndexDaySnapshot[] = [];

  if (indexBuckets && indexBuckets.length > 0) {
    for (const indexBucket of indexBuckets) {
      const name = String(indexBucket.key ?? "");
      if (!name) continue;
      const days = indexBucket.by_day?.buckets ?? [];
      for (const day of days) {
        const date = bucketDate(day);
        if (!date) continue;
        snapshots.push({
          index: name,
          date,
          timestamp: typeof day.key === "number" ? day.key : Date.parse(`${date}T00:00:00.000Z`),
          sizeBytes: num(day.max_size),
          docs: num(day.max_docs),
        });
      }
    }
    return snapshots;
  }

  const clusterDays = body.aggregations?.by_day?.buckets;
  if (clusterDays && clusterDays.length > 0) {
    for (const day of clusterDays) {
      const date = bucketDate(day);
      if (!date) continue;
      snapshots.push({
        index: "_all",
        date,
        timestamp: typeof day.key === "number" ? day.key : Date.parse(`${date}T00:00:00.000Z`),
        sizeBytes: num(day.max_size),
        docs: num(day.max_docs),
      });
    }
    return snapshots;
  }

  throw new Error(
    "No aggregations.indices or aggregations.by_day buckets found. Run the provided Stack Monitoring query and paste the JSON response.",
  );
}

export function datasetFromSnapshots(
  snapshots: IndexDaySnapshot[],
  options: {
    rangeDays: number;
    clusterName?: string;
    version?: string;
    nodes?: number;
    collection?: MonitoringDataset["cluster"]["collection"];
    monitoringIndex?: string;
    timezone?: string;
    fieldMap?: string;
    lastSeen?: string;
    uuid?: string;
  },
): MonitoringDataset {
  if (snapshots.length === 0) {
    throw new Error("No index_stats samples in the selected range.");
  }
  const dates = snapshots.map((s) => s.date).sort();
  const rangeEnd = dates[dates.length - 1] ?? utcToday();
  const { daily, indices } = rollupSnapshots(snapshots, rangeEnd, options.rangeDays);

  const lastDay = daily[daily.length - 1];
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const share = 1 / 24;
    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      timestamp: Date.parse(`${rangeEnd}T${String(hour).padStart(2, "0")}:00:00.000Z`),
      bytes: (lastDay?.bytes ?? 0) * share,
      docs: Math.round((lastDay?.docs ?? 0) * share),
    };
  });

  return {
    cluster: {
      name: options.clusterName ?? "elasticsearch",
      uuid: options.uuid ?? "unknown",
      version: parseVersion(options.version),
      versionSupported: isSupportedEsVersion(options.version),
      versionWarning: versionWarning(options.version),
      nodes: options.nodes ?? 0,
      collection: options.collection ?? "internal",
      monitoringIndex: options.monitoringIndex ?? ".monitoring-es-*",
      lastSeen: options.lastSeen ?? `${rangeEnd}T00:00:00.000Z`,
      timezone: options.timezone ?? "UTC",
      fieldMap: options.fieldMap ?? "primaries.store.size_in_bytes",
    },
    daily,
    hourly,
    indices,
  };
}

export function parsePastedMonitoring(
  raw: string,
  rangeDays: number,
): MonitoringDataset {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Paste is not valid JSON.");
  }
  const snapshots = extractSnapshots(payload);
  return datasetFromSnapshots(snapshots, {
    rangeDays,
    collection: "internal",
    fieldMap: "index_stats.primaries.store.size_in_bytes",
    clusterName: "pasted-response",
    version: "8.14.0",
  });
}
