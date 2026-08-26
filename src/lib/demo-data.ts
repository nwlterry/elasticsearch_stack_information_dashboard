import type {
  ClusterInfo,
  HourlyIngestPoint,
  IndexDaySnapshot,
  MonitoringDataset,
} from "./types";
import { addUtcDays, utcToday } from "./format";
import { rollupSnapshots } from "./ingest";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface StreamSpec {
  name: string;
  dailyBytes: number;
  avgDoc: number;
  weekend: number;
  pri: number;
}

const STREAMS: StreamSpec[] = [
  { name: "logs-openshift.container-default", dailyBytes: 118 * 1024 ** 3, avgDoc: 920, weekend: 0.58, pri: 3 },
  { name: "logs-system.syslog-default", dailyBytes: 64 * 1024 ** 3, avgDoc: 780, weekend: 0.72, pri: 2 },
  { name: "logs-kafka.broker-prod", dailyBytes: 72 * 1024 ** 3, avgDoc: 640, weekend: 0.55, pri: 3 },
  { name: "logs-kafka.connect-prod", dailyBytes: 28 * 1024 ** 3, avgDoc: 710, weekend: 0.5, pri: 2 },
  { name: "metrics-prometheus.remote-default", dailyBytes: 86 * 1024 ** 3, avgDoc: 380, weekend: 0.88, pri: 3 },
  { name: "metrics-system.cpu-default", dailyBytes: 22 * 1024 ** 3, avgDoc: 420, weekend: 0.9, pri: 2 },
  { name: "traces-apm-default", dailyBytes: 48 * 1024 ** 3, avgDoc: 1400, weekend: 0.42, pri: 3 },
  { name: "metrics-apm.internal-default", dailyBytes: 18 * 1024 ** 3, avgDoc: 560, weekend: 0.48, pri: 2 },
  { name: "logs-apm.error-default", dailyBytes: 9 * 1024 ** 3, avgDoc: 1800, weekend: 0.4, pri: 1 },
  { name: "winlogbeat-security", dailyBytes: 31 * 1024 ** 3, avgDoc: 1100, weekend: 0.65, pri: 2 },
  { name: "logs-iis.access-corp", dailyBytes: 24 * 1024 ** 3, avgDoc: 650, weekend: 0.35, pri: 2 },
  { name: "logs-system.auth-default", dailyBytes: 11 * 1024 ** 3, avgDoc: 540, weekend: 0.7, pri: 1 },
  { name: "filebeat-windows-app", dailyBytes: 19 * 1024 ** 3, avgDoc: 820, weekend: 0.45, pri: 2 },
  { name: ".ds-metrics-elasticsearch.stack_monitoring.index-2026.08.26-000012", dailyBytes: 7 * 1024 ** 3, avgDoc: 900, weekend: 1, pri: 1 },
  { name: ".monitoring-es-8-mb", dailyBytes: 6 * 1024 ** 3, avgDoc: 1500, weekend: 1, pri: 1 },
  { name: ".monitoring-kibana-8-mb", dailyBytes: 1.4 * 1024 ** 3, avgDoc: 800, weekend: 1, pri: 1 },
  { name: "logs-openshift.audit-default", dailyBytes: 14 * 1024 ** 3, avgDoc: 1200, weekend: 0.8, pri: 2 },
  { name: "metricbeat-vsphere", dailyBytes: 12 * 1024 ** 3, avgDoc: 480, weekend: 0.95, pri: 2 },
];

function utcWeekday(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

export function buildDemoDataset(asOf: string = utcToday()): MonitoringDataset {
  const seed = Number(asOf.replaceAll("-", "")) ^ 0x51ed;
  const rand = mulberry32(seed);
  const history = 96;
  const start = addUtcDays(asOf, -(history - 1));
  const snapshots: IndexDaySnapshot[] = [];

  for (const stream of STREAMS) {
    let store = stream.dailyBytes * 12;
    let docs = Math.round(store / stream.avgDoc);
    for (let i = 0; i < history; i += 1) {
      const date = addUtcDays(start, i);
      const t = i / history;
      const trend = 1 + t * 0.11;
      const dow = utcWeekday(date);
      const weekend = dow === 0 || dow === 6 ? stream.weekend : 1;
      const noise = 0.9 + rand() * 0.2;
      let burst = 1;
      if (stream.name.includes("kafka") && i === history - 63) burst = 3.4;
      if (i === history - 22) burst = 0.28;
      if (stream.name.includes("openshift") && date.endsWith("-01")) burst *= 1.55;
      const ingest = stream.dailyBytes * trend * weekend * noise * burst;
      store += ingest;
      const ingestDocs = Math.max(1, Math.round(ingest / stream.avgDoc));
      docs += ingestDocs;
      snapshots.push({
        index: stream.name,
        date,
        timestamp: Date.parse(`${date}T00:00:00.000Z`),
        sizeBytes: Math.round(store),
        docs,
      });
    }
  }

  const { daily, indices } = rollupSnapshots(snapshots, asOf, 90);

  const hourly: HourlyIngestPoint[] = [];
  const last = daily[daily.length - 1];
  const todayBytes = last?.bytes ?? 0;
  const todayDocs = last?.docs ?? 0;
  const weights = Array.from({ length: 24 }, (_, hour) => {
    const business = hour >= 8 && hour <= 19 ? 1.45 : 0.55;
    const lunch = hour === 12 || hour === 13 ? 0.85 : 1;
    const nightBatch = hour === 2 || hour === 3 ? 1.7 : 1;
    return business * lunch * nightBatch * (0.92 + rand() * 0.16);
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  for (let hour = 0; hour < 24; hour += 1) {
    const share = weights[hour] / weightSum;
    const stamp = Date.parse(`${asOf}T${String(hour).padStart(2, "0")}:00:00.000Z`);
    hourly.push({
      hour: `${String(hour).padStart(2, "0")}:00`,
      timestamp: stamp,
      bytes: todayBytes * share,
      docs: Math.round(todayDocs * share),
    });
  }

  const cluster: ClusterInfo = {
    name: "obs-prod",
    uuid: "8f3c1a92-4e7b-4c0d-9a11-b6e4d2c81f20",
    version: "8.18.4",
    versionSupported: true,
    versionWarning: null,
    nodes: 16,
    collection: "demo",
    monitoringIndex: ".monitoring-es-8-*,metrics-elasticsearch.stack_monitoring.index-*",
    lastSeen: `${asOf}T23:50:00.000Z`,
    timezone: "UTC",
    fieldMap: "index_stats.primaries.store.size_in_bytes (8.14.0+ aliases)",
  };

  return { cluster, daily, hourly, indices };
}
