import type { StreamFamily } from "./types";

export const FAMILY_COLOR: Record<StreamFamily, string> = {
  logs: "var(--color-family-logs)",
  metrics: "var(--color-family-metrics)",
  kafka: "var(--color-family-kafka)",
  apm: "var(--color-family-apm)",
  system: "var(--color-family-system)",
  other: "var(--color-family-other)",
};

export const FAMILY_LABEL: Record<StreamFamily, string> = {
  logs: "Logs",
  metrics: "Metrics",
  kafka: "Kafka",
  apm: "APM",
  system: "Monitoring",
  other: "Other",
};
