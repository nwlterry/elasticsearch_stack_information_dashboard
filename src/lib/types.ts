export const STREAM_FAMILIES = [
  "logs",
  "metrics",
  "kafka",
  "apm",
  "system",
  "other",
] as const;

export type StreamFamily = (typeof STREAM_FAMILIES)[number];

export type RangeDays = 7 | 14 | 30 | 90;

export type DataMode = "demo" | "live" | "pasted";

export type CollectionKind =
  | "internal"
  | "metricbeat"
  | "elastic-agent"
  | "demo";

export interface FamilyBytes {
  logs: number;
  metrics: number;
  kafka: number;
  apm: number;
  system: number;
  other: number;
}

export interface DailyIngestPoint {
  date: string;
  timestamp: number;
  bytes: number;
  docs: number;
  byFamily: FamilyBytes;
  anomaly: boolean;
}

export interface HourlyIngestPoint {
  hour: string;
  timestamp: number;
  bytes: number;
  docs: number;
}

export interface IndexIngestRow {
  name: string;
  family: StreamFamily;
  ilmPhase: "hot" | "warm" | "cold" | "frozen";
  bytesToday: number;
  bytesPeriod: number;
  docsPeriod: number;
  currentStoreBytes: number;
  sparkline: number[];
  pri: number;
}

export interface ClusterInfo {
  name: string;
  uuid: string;
  version: string;
  versionSupported: boolean;
  versionWarning: string | null;
  nodes: number;
  collection: CollectionKind;
  monitoringIndex: string;
  lastSeen: string;
  timezone: string;
  fieldMap: string;
}

export interface MonitoringDataset {
  cluster: ClusterInfo;
  daily: DailyIngestPoint[];
  hourly: HourlyIngestPoint[];
  indices: IndexIngestRow[];
}

export interface ConnectionConfig {
  url: string;
  apiKey: string;
  indexPattern: string;
  timezone: string;
  collection: "auto" | "internal" | "beats";
}

export interface IndexDaySnapshot {
  index: string;
  date: string;
  timestamp: number;
  sizeBytes: number;
  docs: number;
}
