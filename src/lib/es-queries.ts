export const DEFAULT_MONITORING_PATTERN =
  ".monitoring-es-*,metrics-elasticsearch.stack_monitoring.index-*";

export const MIN_ES_VERSION_LABEL = "8.14.0+";

type EsQuery = {
  size: number;
  track_total_hits: boolean;
  timeout: string;
  runtime_mappings?: Record<string, unknown>;
  query: {
    bool: {
      filter: Array<Record<string, unknown>>;
    };
  };
  aggs: {
    indices: {
      terms: { field: string; size: number; order: { peak_size: string } };
      aggs: {
        peak_size: { max: { field: string } };
        by_day: {
          date_histogram: {
            field: string;
            calendar_interval: string;
            min_doc_count: number;
            time_zone: string;
          };
          aggs: {
            max_size: { max: { field: string } };
            max_docs: { max: { field: string } };
          };
        };
      };
    };
  };
};

/** Legacy / Metricbeat xpack collection on .monitoring-es-8-* (still valid on 8.14.0+). */
export const INTERNAL_INDEX_STATS_QUERY: EsQuery = {
  size: 0,
  track_total_hits: false,
  timeout: "15s",
  query: {
    bool: {
      filter: [
        { term: { type: "index_stats" } },
        { range: { timestamp: { gte: "now-91d/d", lte: "now" } } },
      ],
    },
  },
  aggs: {
    indices: {
      terms: {
        field: "index_stats.index",
        size: 800,
        order: { peak_size: "desc" },
      },
      aggs: {
        peak_size: { max: { field: "index_stats.primaries.store.size_in_bytes" } },
        by_day: {
          date_histogram: {
            field: "timestamp",
            calendar_interval: "1d",
            min_doc_count: 1,
            time_zone: "UTC",
          },
          aggs: {
            max_size: { max: { field: "index_stats.primaries.store.size_in_bytes" } },
            max_docs: { max: { field: "index_stats.primaries.docs.count" } },
          },
        },
      },
    },
  },
};

/**
 * Elastic Agent / Metricbeat elasticsearch module on 8.14.0+.
 * Canonical fields: elasticsearch.index.* with index_stats.* aliases.
 */
export const BEATS_INDEX_STATS_QUERY: EsQuery = {
  size: 0,
  track_total_hits: false,
  timeout: "15s",
  query: {
    bool: {
      filter: [
        {
          bool: {
            should: [
              { term: { "data_stream.dataset": "elasticsearch.stack_monitoring.index" } },
              { exists: { field: "elasticsearch.index.name" } },
            ],
            minimum_should_match: 1,
          },
        },
        { range: { "@timestamp": { gte: "now-91d/d", lte: "now" } } },
      ],
    },
  },
  aggs: {
    indices: {
      terms: {
        field: "elasticsearch.index.name",
        size: 800,
        order: { peak_size: "desc" },
      },
      aggs: {
        peak_size: { max: { field: "elasticsearch.index.primaries.store.size_in_bytes" } },
        by_day: {
          date_histogram: {
            field: "@timestamp",
            calendar_interval: "1d",
            min_doc_count: 1,
            time_zone: "UTC",
          },
          aggs: {
            max_size: { max: { field: "elasticsearch.index.primaries.store.size_in_bytes" } },
            max_docs: { max: { field: "elasticsearch.index.primaries.docs.count" } },
          },
        },
      },
    },
  },
};

/**
 * Elasticsearch 8.14.0+ unified query.
 * Runtime fields cover both .monitoring-es-* (type=index_stats) and
 * metrics-elasticsearch.stack_monitoring.index-* (Agent aliases).
 */
export const ES_814_COMBINED_QUERY: EsQuery = {
  size: 0,
  track_total_hits: false,
  timeout: "15s",
  runtime_mappings: {
    "ingest.index": {
      type: "keyword",
      script:
        "if (doc.containsKey('elasticsearch.index.name') && doc['elasticsearch.index.name'].size() != 0) { emit(doc['elasticsearch.index.name'].value); } else if (doc.containsKey('index_stats.index') && doc['index_stats.index'].size() != 0) { emit(doc['index_stats.index'].value); }",
    },
    "ingest.size_bytes": {
      type: "long",
      script:
        "if (doc.containsKey('elasticsearch.index.primaries.store.size_in_bytes') && doc['elasticsearch.index.primaries.store.size_in_bytes'].size() != 0) { emit((long)doc['elasticsearch.index.primaries.store.size_in_bytes'].value); } else if (doc.containsKey('index_stats.primaries.store.size_in_bytes') && doc['index_stats.primaries.store.size_in_bytes'].size() != 0) { emit((long)doc['index_stats.primaries.store.size_in_bytes'].value); }",
    },
    "ingest.docs": {
      type: "long",
      script:
        "if (doc.containsKey('elasticsearch.index.primaries.docs.count') && doc['elasticsearch.index.primaries.docs.count'].size() != 0) { emit((long)doc['elasticsearch.index.primaries.docs.count'].value); } else if (doc.containsKey('index_stats.primaries.docs.count') && doc['index_stats.primaries.docs.count'].size() != 0) { emit((long)doc['index_stats.primaries.docs.count'].value); }",
    },
    "ingest.ts": {
      type: "date",
      script:
        "if (doc.containsKey('@timestamp') && doc['@timestamp'].size() != 0) { emit(doc['@timestamp'].value.toInstant().toEpochMilli()); } else if (doc.containsKey('timestamp') && doc['timestamp'].size() != 0) { emit(doc['timestamp'].value.toInstant().toEpochMilli()); }",
    },
  },
  query: {
    bool: {
      filter: [
        {
          bool: {
            should: [
              { term: { type: "index_stats" } },
              { term: { "data_stream.dataset": "elasticsearch.stack_monitoring.index" } },
              { exists: { field: "elasticsearch.index.name" } },
              { exists: { field: "index_stats.index" } },
            ],
            minimum_should_match: 1,
          },
        },
        {
          bool: {
            should: [
              { range: { timestamp: { gte: "now-91d/d", lte: "now" } } },
              { range: { "@timestamp": { gte: "now-91d/d", lte: "now" } } },
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  },
  aggs: {
    indices: {
      terms: {
        field: "ingest.index",
        size: 800,
        order: { peak_size: "desc" },
      },
      aggs: {
        peak_size: { max: { field: "ingest.size_bytes" } },
        by_day: {
          date_histogram: {
            field: "ingest.ts",
            calendar_interval: "1d",
            min_doc_count: 1,
            time_zone: "UTC",
          },
          aggs: {
            max_size: { max: { field: "ingest.size_bytes" } },
            max_docs: { max: { field: "ingest.docs" } },
          },
        },
      },
    },
  },
};

function patchQuery(node: unknown, rangeDays: number, timeZone: string) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) patchQuery(item, rangeDays, timeZone);
    return;
  }
  const rec = node as Record<string, unknown>;
  if (rec.range && typeof rec.range === "object") {
    const range = rec.range as Record<string, { gte?: string; lte?: string }>;
    for (const field of Object.keys(range)) {
      range[field] = { gte: `now-${rangeDays + 1}d/d`, lte: "now" };
    }
  }
  if (rec.date_histogram && typeof rec.date_histogram === "object") {
    (rec.date_histogram as { time_zone?: string }).time_zone = timeZone;
  }
  for (const value of Object.values(rec)) patchQuery(value, rangeDays, timeZone);
}

export function withTimeZone(query: EsQuery, timeZone: string, rangeDays: number): EsQuery {
  const cloned = structuredClone(query);
  patchQuery(cloned, rangeDays, timeZone);
  return cloned;
}

export const METHOD_NOTE =
  "Built for Elasticsearch 8.14.0+. Daily ingest is the day-over-day increase in primaries.store.size_in_bytes from Stack Monitoring index_stats (internal collection) or elasticsearch.index.primaries.store.size_in_bytes (Elastic Agent / Metricbeat). Values are floored at zero so ILM deletes and shrinks do not count as negative ingest. New backing indices contribute their full primary size on the day they first appear. Replica copies are excluded.";
