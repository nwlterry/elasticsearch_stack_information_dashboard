# Elasticsearch Stack Information Dashboard

Daily ingest size from **Stack Monitoring** index stats.

**Supported versions: Elasticsearch 8.14.0 and later** (8.14–8.18, 9.x).

The dashboard computes calendar-day ingest as the day-over-day increase in **primary** store size, floored at zero so ILM deletes and shrinks do not look like negative ingest. Replica copies are excluded.

## Repository layout

| Path | Purpose |
|---|---|
| `queries/daily_ingest_8.14_unified.json` | Preferred Dev Tools query. Runtime fields unify internal collection and Elastic Agent. |
| `queries/daily_ingest_internal.json` | `.monitoring-es-*` only (`type=index_stats`). |
| `queries/daily_ingest_agent.json` | Elastic Agent `metrics-elasticsearch.stack_monitoring.index-*` only. |
| `scripts/daily_ingest_from_monitoring.sh` | Cluster-side script: search + day-over-day GiB table. |
| `src/components/dashboard/` | Ingest Watch UI (KPIs, stacked chart, calendar, index table). |
| `src/lib/` | Ingest math, 8.14.0+ queries, parsers, version gate. |

## Monitoring sources (8.14.0+)

| Collection | Index / data stream | Size field | Timestamp |
|---|---|---|---|
| Internal / Metricbeat xpack | `.monitoring-es-*` | `index_stats.primaries.store.size_in_bytes` | `timestamp` |
| Elastic Agent | `metrics-elasticsearch.stack_monitoring.index-*` | `elasticsearch.index.primaries.store.size_in_bytes` (alias: `index_stats.primaries.store.size_in_bytes`) | `@timestamp` (alias: `timestamp`) |

Default pattern used by the dashboard and the shell script:

```
.monitoring-es-*,metrics-elasticsearch.stack_monitoring.index-*
```

## Dev Tools queries

Copy from `queries/`:

1. **`queries/daily_ingest_8.14_unified.json`** — preferred. Runtime fields unify both collections. Run against the combined pattern above (`ignore_unavailable=true`).
2. **`queries/daily_ingest_internal.json`** — `.monitoring-es-*` only (`type=index_stats`).
3. **`queries/daily_ingest_agent.json`** — Agent data stream only.

Paste the JSON response into the dashboard **Connect → Paste JSON** tab, or parse it with the script below.

Change `now-31d/d` and `time_zone` as needed.

## Cluster-side script

For a private 8.14.0+ cluster (no public URL required):

```bash
export ES_URL=https://es.example.com:9200
export ES_API_KEY='...'          # or ES_USER / ES_PASSWORD
chmod +x scripts/daily_ingest_from_monitoring.sh
./scripts/daily_ingest_from_monitoring.sh 30 UTC
```

Optional: `ES_MONITORING_PATTERN` to override the index pattern.

API key needs `monitor` plus `read` on the monitoring indices / data streams.

## Method

For each index, take `max(primaries.store.size_in_bytes)` per UTC (or configured) calendar day. Daily ingest for that index is:

```
max(0, size[day] - size[day-1])
```

A new backing index (first seen that day) contributes its full primary size. Sum across indices for cluster daily ingest.

This is **not** `_all` store size serial-diff (ILM on one index would hide ingest on another).

## Dashboard UI

Ingest Watch in this repo:

- Daily stacked ingest by family (logs / metrics / Kafka / APM / monitoring)
- 7 / 14 / 30 / 90 day range, calendar heatmap, index table
- Live query (public ES URL + API key) or paste a Dev Tools aggregation
- Warns if the connected cluster is older than **8.14.0**

Stack: React 19, TanStack Start, Tailwind v4, recharts.

## License

Internal operations use.
