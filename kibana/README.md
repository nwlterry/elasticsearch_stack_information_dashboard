# Ingest Watch → Kibana (internal collection)

Kibana-native equivalent of the standalone **Ingest Watch** dashboard, targeted at:

- **Elasticsearch / Kibana 8.14.0+** (verified pattern: **8.18.4**)
- **Internal Stack Monitoring** only: `.monitoring-es-*`, `type: index_stats`
- **No Elastic Agent / Fleet** required for this path

This is **not** an automatic 1:1 port of the React UI. Exact ingest math in Kibana needs one of:

1. **ES|QL** (ad-hoc tables / Discover), or  
2. **TSVB** (derivative of daily max primary store), or  
3. A **transform** for daily peak store, or  
4. A **Watcher** that writes `ingest_bytes` into `ingest-watch-daily` (best for Lens).

## What maps from the React app

| React panel | Kibana approach |
|-------------|-----------------|
| KPI: period ingest | Lens on `ingest-watch-daily` (`scope: cluster`) or TSVB positive derivative |
| Daily stacked chart by family | Lens on `ingest-watch-daily` (`scope: index`) split by `stream_family` |
| Index table | Lens table on `ingest-watch-daily` (`scope: index`) |
| Calendar heatmap | Lens heatmap on daily `ingest_bytes` |
| Hourly chart | Not produced by the daily watch (use TSVB 1h or the React app) |
| Connect / paste | Not needed — Kibana / Watcher query the cluster directly |

## Method (same as the script)

For each monitored **data index name** (`index_stats.index`):

1. Take `max(index_stats.primaries.store.size_in_bytes)` per calendar day.  
2. Daily ingest for that index = `max(0, size[day] - size[day-1])`.  
3. Cluster daily ingest = sum of those deltas.

Replicas are excluded (primaries only). ILM shrinks/deletes do not become negative ingest.

## Quick start (internal, on-prem)

### 1. Confirm monitoring data

```http
GET .monitoring-es-*/_search?size=0
{
  "query": { "term": { "type": "index_stats" } }
}
```

If empty:

```http
PUT _cluster/settings
{
  "persistent": {
    "xpack.monitoring.collection.enabled": true
  }
}
```

### 2. Create a data view

- Name: `Stack Monitoring ES (internal)`
- Index pattern: `.monitoring-es-*`
- Timestamp field: `timestamp`
- Filter (optional, recommended): `type: index_stats`

Or import `objects/data-view.ndjson`.

### 3. Choose a path

| Path | Effort | Best for |
|------|--------|----------|
| **A. ES\|QL** | Low | Ad-hoc daily table (peak store, not delta) |
| **B. TSVB dashboard** | Medium | Fast charts without extra indices |
| **C. Transform + Lens** | Higher | Peak-size tables |
| **D. Watcher → Lens** | Medium | Exact ingest field for Lens (**recommended**) |

Path D setup: `docs/watcher-setup.md`. Bodies: `watchers/`.

## Importable objects

| File | Purpose |
|------|---------|
| `objects/data-view.ndjson` | Data view for `.monitoring-es-*` |
| `objects/dashboard-skeleton.ndjson` | Dashboard shell + method notes |
| `queries/daily_ingest_internal.json` | Dev Tools body (internal) |
| `watchers/ingest-watch-daily-index.json` | Index template for `ingest-watch-daily` |
| `watchers/ingest-watch-daily-internal.json` | Daily watch |

**Import saved objects:** Kibana → **Stack Management → Saved Objects → Import**.

Keep the GitHub repo script (`ES_COLLECTION=internal`) for CLI reporting and backfill.
