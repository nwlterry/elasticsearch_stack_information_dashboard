# Ingest Watch → Kibana (internal collection)

Kibana-native equivalent of the standalone **Ingest Watch** dashboard, targeted at:

- **Elasticsearch / Kibana 8.14.0+** (verified pattern: **8.18.4**)
- **Internal Stack Monitoring** only: `.monitoring-es-*`, `type: index_stats`
- **No Elastic Agent / Fleet** required for this path

This is **not** an automatic 1:1 port of the React UI. Kibana cannot natively run the exact per-index day-over-day Python logic without either:

1. **ES|QL** (ad-hoc tables / Discover), or  
2. **TSVB** (derivative of daily max primary store), or  
3. A **transform** that materializes daily ingest (best for a permanent dashboard).

## What maps from the React app

| React panel | Kibana approach |
|-------------|-----------------|
| KPI: period ingest | Metric / Lens on transform `ingest_bytes` or TSVB sum of positive derivative |
| Daily stacked chart by family | Lens bar on transform + runtime `family` field, or TSVB split by index (no family) |
| Index table | Lens table / Discover on transform |
| Calendar heatmap | Lens heatmap on daily ingest (transform) |
| Hourly chart | Optional second transform or TSVB 1h interval (less reliable for store-size gauge) |
| Connect / paste | Not needed — Kibana queries the cluster directly |

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

Or import `objects/data-view.ndjson` (see below).

### 3. Choose a path

| Path | Effort | Best for |
|------|--------|----------|
| **A. ES\|QL** | Low | Ad-hoc daily table (closest to the shell script) |
| **B. TSVB dashboard** | Medium | Fast charts without a transform |
| **C. Transform + Lens** | Higher | Stable production dashboard (recommended) |

---

## Path A — ES|QL (closest to the script)

In **Discover → ES|QL**, use queries under `esql/`.

Limitations: day-over-day across buckets is awkward in pure ES|QL without a two-step or transform. Use the **pivot + client logic** approach:

1. Run `esql/01_daily_max_store_by_index.kql` (ES|QL).  
2. Export CSV and apply the same delta math, **or**  
3. Prefer **Path C** for automatic deltas.

A practical ES|QL “raw peak store by day” is provided so you can validate monitoring data quickly.

---

## Path B — TSVB (no transform)

Create a dashboard and add **TSVB** panels:

1. **Data view**: `.monitoring-es-*`  
2. **Panel time**: last 30 days  
3. **Filter**: `type: index_stats`  
4. Metric: **Max** of `index_stats.primaries.store.size_in_bytes`  
5. Group by: `index_stats.index` (Terms, size 200–800)  
6. Series aggregation: **Derivative** (unit: 1d) + **Positive Only**  
7. Panel aggregation: **Sum** of series (cluster daily ingest)

This approximates the React/script method. First day in the window is inflated (no prior point), same as the script.

Family stacking is **not** available unless you add a runtime field `family` (see `docs/runtime-family.md`).

---

## Path C — Transform + Lens (recommended)

1. Install transform `transforms/daily_index_store_max.json` (creates daily max store per index).  
2. Optionally run `transforms/daily_ingest_delta` logic via a second transform or an ingest pipeline — or compute deltas in Lens is not available; use the provided **pivot transform** that stores both `max_size` and rely on a **runtime / scripted metric** approach documented in `docs/transform-setup.md`.  
3. Simpler production pattern included: one transform writes `monitoring-ingest-daily` with fields `date`, `index_name`, `max_primary_bytes`. A **watcher or small script** (same as repo script) can write `ingest_bytes` into a second index for Lens.

For a pure Kibana API approach without external script, use **Path B (TSVB)** for the chart and **ES|QL / Discover** for the table.

---

## Importable objects

| File | Purpose |
|------|---------|
| `objects/data-view.ndjson` | Data view for `.monitoring-es-*` |
| `objects/dashboard-skeleton.ndjson` | Empty dashboard shell + markdown panel with method notes |
| `queries/daily_ingest_internal.json` | Same Dev Tools body as the standalone app (internal) |

**Import:** Kibana → **Stack Management → Saved Objects → Import**.

After import, edit the dashboard panels and point visualizations at your data view / transform destination index.

---

## Security

API key / role needs:

- `monitor` (cluster)
- `read` on `.monitoring-es-*`
- If using transforms: `manage_transform`, `read`/`write` on the destination index

---

## Relation to the standalone app

| | Standalone Ingest Watch | This Kibana package |
|--|-------------------------|---------------------|
| Runs where | Browser app / paste JSON | Inside your Kibana |
| Private RFC1918 | Paste or cluster script | Native (Kibana already on the network) |
| Exact delta math | Yes (Python) | TSVB ≈ yes; exact = transform/script |
| Family breakdown | Built-in | Runtime field or index-name patterns |

Keep the GitHub repo script (`ES_COLLECTION=internal`) for CLI reporting; use this package for the on-prem Kibana UI.
