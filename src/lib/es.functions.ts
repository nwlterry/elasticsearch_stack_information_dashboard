import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  withTimeZone,
  INTERNAL_INDEX_STATS_QUERY,
  BEATS_INDEX_STATS_QUERY,
  ES_814_COMBINED_QUERY,
} from "./es-queries";
import { datasetFromSnapshots, extractSnapshots } from "./parse-monitoring";
import type { MonitoringDataset } from "./types";
import { versionWarning } from "./version";

const InputSchema = z.object({
  url: z.string().min(8),
  apiKey: z.string().min(1),
  indexPattern: z.string().min(1),
  timezone: z.string().min(1),
  rangeDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)]),
  collection: z.union([z.literal("auto"), z.literal("internal"), z.literal("beats")]),
});

function assertSafeUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Elasticsearch URL is not valid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Put credentials in the API key field, not the URL.");
  }
  return parsed;
}

function assertPattern(pattern: string) {
  if (!/^[a-zA-Z0-9._*\-,]+$/.test(pattern)) {
    throw new Error("Index pattern may only contain letters, numbers, . _ - * ,");
  }
}

function searchPath(origin: string, pattern: string): string {
  const encoded = pattern
    .split(",")
    .map((part) => encodeURIComponent(part.trim()).replaceAll("%2A", "*"))
    .join(",");
  return `${origin}/${encoded}/_search?ignore_unavailable=true&allow_no_indices=true`;
}

async function esFetch(url: string, apiKey: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `ApiKey ${apiKey}`,
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Elasticsearch request timed out after 20s.");
    }
    throw new Error(
      "Cannot reach Elasticsearch. The cluster must be publicly reachable (Elastic Cloud or a reverse proxy). Private RFC1918 addresses are blocked from this app — paste a Dev Tools response instead.",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readEsError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { error?: { reason?: string; type?: string } };
    if (json.error?.reason) return json.error.reason;
  } catch {
    /* ignore */
  }
  if (response.status === 401 || response.status === 403) {
    return "Authentication failed. Check the API key and that it can read the monitoring indices.";
  }
  if (response.status === 404) {
    return "Monitoring index not found. For 8.14.0+ try .monitoring-es-* or metrics-elasticsearch.stack_monitoring.index-*";
  }
  return text.slice(0, 240) || `Elasticsearch returned HTTP ${response.status}`;
}

export const fetchMonitoringIngest = createServerFn({ method: "POST" })
  .validator(InputSchema)
  .handler(async ({ data }): Promise<MonitoringDataset> => {
    const parsed = assertSafeUrl(data.url);
    assertPattern(data.indexPattern);
    const origin = parsed.origin;

    const rootRes = await esFetch(origin, data.apiKey);
    if (!rootRes.ok) throw new Error(await readEsError(rootRes));
    const root = (await rootRes.json()) as {
      name?: string;
      cluster_uuid?: string;
      version?: { number?: string };
    };

    const warning = versionWarning(root.version?.number);
    if (warning) {
      console.warn(warning);
    }

    let nodes = 0;
    try {
      const healthRes = await esFetch(`${origin}/_cluster/health`, data.apiKey);
      if (healthRes.ok) {
        const health = (await healthRes.json()) as { number_of_nodes?: number };
        nodes = health.number_of_nodes ?? 0;
      }
    } catch {
      /* optional */
    }

    const attempts: Array<{
      collection: "internal" | "metricbeat" | "elastic-agent";
      query: unknown;
      fieldMap: string;
    }> = [];

    const combined = withTimeZone(ES_814_COMBINED_QUERY, data.timezone, data.rangeDays);
    const internalQ = withTimeZone(INTERNAL_INDEX_STATS_QUERY, data.timezone, data.rangeDays);
    const beatsQ = withTimeZone(BEATS_INDEX_STATS_QUERY, data.timezone, data.rangeDays);

    if (data.collection === "auto") {
      attempts.push({
        collection: "elastic-agent",
        query: combined,
        fieldMap: "ingest.size_bytes (8.14.0+ unified runtime fields)",
      });
      attempts.push({
        collection: "metricbeat",
        query: beatsQ,
        fieldMap: "elasticsearch.index.primaries.store.size_in_bytes",
      });
      attempts.push({
        collection: "internal",
        query: internalQ,
        fieldMap: "index_stats.primaries.store.size_in_bytes",
      });
    } else if (data.collection === "beats") {
      attempts.push({
        collection: "metricbeat",
        query: beatsQ,
        fieldMap: "elasticsearch.index.primaries.store.size_in_bytes",
      });
    } else {
      attempts.push({
        collection: "internal",
        query: internalQ,
        fieldMap: "index_stats.primaries.store.size_in_bytes",
      });
    }

    let lastError = "No monitoring documents matched for Elasticsearch 8.14.0+.";
    for (const attempt of attempts) {
      const response = await esFetch(searchPath(origin, data.indexPattern), data.apiKey, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(attempt.query),
      });
      if (!response.ok) {
        lastError = await readEsError(response);
        continue;
      }
      const payload: unknown = await response.json();
      try {
        const snapshots = extractSnapshots(payload);
        if (snapshots.length === 0) continue;
        return datasetFromSnapshots(snapshots, {
          rangeDays: data.rangeDays,
          clusterName: root.name ?? parsed.hostname,
          version: root.version?.number ?? "unknown",
          nodes,
          uuid: root.cluster_uuid ?? "unknown",
          collection: attempt.collection,
          monitoringIndex: data.indexPattern,
          timezone: data.timezone,
          fieldMap: attempt.fieldMap,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
      }
    }

    throw new Error(lastError);
  });
