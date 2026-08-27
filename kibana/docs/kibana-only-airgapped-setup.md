# Kibana-only air-gapped setup (Path D — Watcher + Lens)

Operator runbook for a **self-managed, no-internet** Elasticsearch/Kibana cluster.
Uses **only Kibana UI and Dev Tools Console**. Copy files from this repo onto the host; nothing is downloaded at runtime.

**Recommended path:** combined Watcher task → `ingest-watch-daily` → Lens on a Kibana dashboard.

| Pin | Value |
|-----|-------|
| Dashboard | **1.0.3** |
| Elasticsearch / Kibana | **8.14.0+** (verified **8.18.4**), same version on both |
| Collection | Internal Stack Monitoring |
| Source | `.monitoring-es-*`, `type=index_stats` |
| Destination | `ingest-watch-daily` |
| Combined task | `kibana/watchers/ingest-watch-daily-combined.json` |
| Watch id | `ingest-watch-daily-combined` |

Ingest formula (unchanged):

```
ingest = max(0, max_primary_store[day] − max_primary_store[day-1])
```

---

## 1. Prerequisites

- Elasticsearch and Kibana at the **same** version (8.14.0+, verified 8.18.4).
- Air-gapped / no internet at runtime. No Elastic Cloud, no package registry, no Artifact Registry.
- Internal Stack Monitoring available (`.monitoring-es-*`).
- A user that can open Kibana **Dev Tools**, **Stack Management → Saved Objects**, and **Dashboards / Lens**.
- Privileges for Watcher Path D: cluster `manage_watcher`, `monitor`; read on `.monitoring-es-*`; write on `ingest-watch-daily`.

Copy this repository (or at least the `kibana/` tree) onto a machine that can reach Kibana.

---

## 2–3. Enable collection and confirm `index_stats`

```http
PUT _cluster/settings
{
  "persistent": { "xpack.monitoring.collection.enabled": true }
}

GET .monitoring-es-*/_search?size=0
{
  "query": { "term": { "type": "index_stats" } }
}
```

Expect `hits.total` > 0.

---

## 4. Import saved objects (from this repo, no download)

Copy onto the Kibana host:

- `kibana/objects/data-view-ingest-watch-daily.ndjson` — Lens data view
- `kibana/objects/dashboard-skeleton.ndjson` — dashboard shell
- `kibana/objects/data-view.ndjson` — optional `.monitoring-es-*`

**Stack Management → Saved Objects → Import**. Overwrite the old skeleton if you already imported it.

The skeleton uses a classic **visualization / markdown** panel. Dashboard panel type `markdown` is not registered on 8.18.4 (`No embeddable factory found for type: markdown` — issue #3).

---

## 5–6. Combined watch + execute once

Open `kibana/watchers/ingest-watch-daily-combined.json`.

```http
PUT _index_template/ingest-watch-daily
```

Body: the file’s **`index_template`** object.

```http
PUT _watcher/watch/ingest-watch-daily-combined
```

Body: the file’s **`watch`** object (no `doc_id` on the index action — issue #2).

```http
POST _watcher/watch/ingest-watch-daily-combined/_execute
{
  "record_execution": true
}

GET ingest-watch-daily/_search
{
  "size": 20,
  "sort": [{ "ingest_bytes": "desc" }],
  "query": { "term": { "scope": "cluster" } }
}
```

Schedule is 01:15 UTC. Expect `scope: cluster` plus per-index docs for the latest complete UTC day.

---

## 7. Data view

Import `data-view-ingest-watch-daily.ndjson` or create manually:

| Setting | Value |
|---------|-------|
| Name | `Ingest Watch daily` |
| Index pattern | `ingest-watch-daily` |
| Timestamp field | `@timestamp` |

---

## 8. Build Lens panels like the React dashboard

Full click-path: **`kibana/docs/lens-setup.md`**.

Open **Analytics → Dashboard → Ingest Watch (Kibana · internal)**. Time picker: Last 30 days. Data view for every panel: **Ingest Watch daily**.

**Add panel → Lens**:

| React panel | Lens type | KQL | Build |
|-------------|-----------|-----|--------|
| Period KPI | Metric | `scope: cluster` | Sum `ingest_bytes`, format Bytes |
| Daily ingest chart | Bar | `scope: cluster` | `@timestamp` 1d × Sum `ingest_bytes` |
| Stacked by family | Stacked bar | `scope: index` | same + break down `stream_family` |
| Family share | Donut | `scope: index` | Sum `ingest_bytes` by `stream_family` |
| Calendar heatmap | Heatmap | `scope: index` | `@timestamp` 1d × `stream_family` |
| Index table | Table | `scope: index` | Rows `index_name`, Sum `ingest_bytes` desc |
| Hourly chart | skip | Watcher index is daily only | — |

Do not mix `scope: cluster` into family/table panels. Do not chart `.monitoring-es-*` here.

---

## 9. Optional: deactivate the legacy watch

```http
PUT _watcher/watch/ingest-watch-daily-internal/_deactivate
```

---

## 10. Common failures

| Symptom | Likely cause |
|---------|----------------|
| `No embeddable factory found for type: markdown` | Re-import current `dashboard-skeleton.ndjson` (issue #3) |
| Watch index action failure about `_id` + `doc_id` | Re-PUT watch from current combined file (issue #2) |
| KPI empty but index docs exist | Lens filter missing `scope: cluster` |
| Duplicate cluster totals | Both watches active |
| Wrong calendar day | Histogram is UTC |

---

## Related docs

- Lens vs React: `kibana/docs/lens-setup.md`
- Combined task: `kibana/watchers/ingest-watch-daily-combined.json`
- Watcher steps: `kibana/docs/watcher-setup.md`
- Root pin: `ONPREM.md`, `VERSION`
