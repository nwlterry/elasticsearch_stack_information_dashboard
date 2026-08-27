# Elasticsearch Stack Information Dashboard

Daily ingest size from **Stack Monitoring** index stats.

**Supported versions: Elasticsearch 8.14.0 and later** (8.14–8.18, 9.x).  
Dashboard release: **1.0.3**. On-prem / air-gapped pin: **Elasticsearch 8.14.0+** with internal collection `.monitoring-es-*` (verified **8.18.4**).

Start here for a map of every update: **[UPDATES.md](UPDATES.md)** · history: **[CHANGELOG.md](CHANGELOG.md)**

The dashboard computes calendar-day ingest as the day-over-day increase in **primary** store size, floored at zero so ILM deletes and shrinks do not look like negative ingest. Replica copies are excluded.

## On-prem / air-gapped (no internet)

This is the path for a self-managed cluster with no Elastic Cloud, no package download, and no runtime internet.

| Item | Version / value |
|---|---|
| Dashboard | **1.0.3** |
| Elasticsearch | **8.14.0 minimum**, verified **8.18.4**, also 8.14–8.18 and 9.x |
| Kibana | Same version as Elasticsearch |
| Collection | **Internal** (built into Elasticsearch) or **Metricbeat** xpack. Both write `.monitoring-es-*`. |
| Index pattern | `.monitoring-es-*` |
| Dev Tools query | `queries/daily_ingest_internal.json` |
| Script | `scripts/daily_ingest_from_monitoring.sh` (1.0.1+ temp-file parse) |
| Script runtime | bash, curl, python3 ≥ 3.6 (RHEL 8 default is enough) |
| Kibana package | `kibana/` (optional; Watcher Path D for Lens) |
| Kibana-only guide | [`kibana/docs/kibana-only-airgapped-setup.md`](kibana/docs/kibana-only-airgapped-setup.md) |

Internal collection is enabled on the cluster (no extra binaries):

```
PUT _cluster/settings
{
  "persistent": {
    "xpack.monitoring.collection.enabled": true
  }
}
```

Then from a host that can reach Elasticsearch (still no internet):

```bash
export ES_URL=https://es.example.com:9200
export ES_API_KEY='...'
export ES_COLLECTION=internal
./scripts/daily_ingest_from_monitoring.sh 30 UTC
```

Or paste `queries/daily_ingest_internal.json` in Kibana Dev Tools against `.monitoring-es-*`.

Do **not** use Elastic Agent / Fleet for this path unless you already host a local Elastic Package Registry and Artifact Registry. Agent collection needs those local mirrors in an air-gapped network. Metricbeat and internal collection do not.

Internal Elasticsearch monitoring is deprecated and scheduled for removal in **10.0**. It remains valid on 8.14–8.18 and 9.x. Pin **8.18.4** (or same-minor Kibana) for current on-prem; stay on 8.x/9.x if you rely on `.monitoring-es-*` without Agent.

See `VERSION` and `ONPREM.md` in the repo root.

## Repository layout

| Path | Purpose |
|---|---|
| `UPDATES.md` | Organized index of all updates and which tool to use. |
| `CHANGELOG.md` | Version history (1.0.0 → 1.0.3). |
| `VERSION` | Pinned dashboard + Elasticsearch versions for on-prem / air-gapped. |
| `ONPREM.md` | Air-gapped on-prem runbook (ES 8.14.0+ / verified 8.18.4). |
| `queries/daily_ingest_8.14_unified.json` | Preferred Dev Tools query when both collections exist. Runtime fields unify internal collection and Elastic Agent. |
| `queries/daily_ingest_internal.json` | `.monitoring-es-*` only (`type=index_stats`). |
| `queries/daily_ingest_agent.json` | Elastic Agent `metrics-elasticsearch.stack_monitoring.index-*` only. |
| `scripts/daily_ingest_from_monitoring.sh` | Cluster-side script: search + day-over-day GiB table. |
| `kibana/` | Kibana-native package (ES|QL, TSVB, transform, Watcher → Lens). |
| `kibana/docs/kibana-only-airgapped-setup.md` | Kibana-only air-gapped operator runbook. |
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

On-prem / no internet — use internal collection:

```bash
export ES_URL=https://es.example.com:9200
export ES_API_KEY='...'          # or ES_USER / ES_PASSWORD
export ES_COLLECTION=internal
chmod +x scripts/daily_ingest_from_monitoring.sh
./scripts/daily_ingest_from_monitoring.sh 30 UTC
```

`ES_COLLECTION=auto` (default) runs the 8.14 unified query against both `.monitoring-es-*` and Agent data streams. `ES_COLLECTION=agent` is Agent-only.

Optional: `ES_MONITORING_PATTERN` to override the index pattern.

API key needs `monitor` plus `read` on the monitoring indices / data streams.

Use **1.0.1+** of the script. Earlier builds passed the search JSON on argv and failed with `Argument list too long` on large clusters.

## Kibana (optional)

If Kibana already runs on the cluster network, see `kibana/README.md` and the Kibana-only air-gapped guide [`kibana/docs/kibana-only-airgapped-setup.md`](kibana/docs/kibana-only-airgapped-setup.md).

| Path | Role |
|------|------|
| A ES|QL | Peak primary store by day (not ingest delta) |
| B TSVB | Approximate ingest (Max → Terms → Derivative 1d → Positive Only) |
| C Transform | Daily peak-store index `monitoring-ingest-daily` |
| D Watcher | Exact ingest into `ingest-watch-daily` for Lens (**recommended**) |

Recommended combined task: `kibana/watchers/ingest-watch-daily-combined.json` (template + watch).  
Watcher setup: `kibana/docs/watcher-setup.md`.

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
