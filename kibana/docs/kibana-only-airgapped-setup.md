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
- Privileges for Watcher Path D:
  - Cluster: `manage_watcher`, `monitor`
  - `.monitoring-es-*`: `read`, `view_index_metadata`
  - `ingest-watch-daily`: `create_index`, `index`, `write`, `view_index_metadata`

Copy this repository (or at least the `kibana/` tree) onto a machine that can reach Kibana. You will paste JSON into Dev Tools and import NDJSON via the UI — no `curl` to the public internet.

---

## 2. Enable internal monitoring collection

In **Kibana → Dev Tools**:

```http
PUT _cluster/settings
{
  "persistent": {
    "xpack.monitoring.collection.enabled": true
  }
}
```

Confirm:

```http
GET _cluster/settings?include_defaults=false&filter_path=**.xpack.monitoring.collection.enabled
```

Allow a few minutes for `.monitoring-es-*` documents to appear after first enable.

---

## 3. Confirm `.monitoring-es-*` has `type=index_stats`

```http
GET .monitoring-es-*/_search?size=0
{
  "query": { "term": { "type": "index_stats" } }
}
```

Expect `hits.total` &gt; 0. Spot-check fields:

```http
GET .monitoring-es-*/_search
{
  "size": 1,
  "query": { "term": { "type": "index_stats" } },
  "_source": [
    "timestamp",
    "type",
    "index_stats.index",
    "index_stats.primaries.store.size_in_bytes",
    "index_stats.primaries.docs.count"
  ]
}
```

If empty, collection is off, wrong pattern, or privileges block reads — see §10.

---

## 4. Import saved objects (from this repo, no download)

Copy onto the Kibana host (USB / internal share / already-synced repo):

- `kibana/objects/data-view.ndjson`
- `kibana/objects/dashboard-skeleton.ndjson`

In Kibana:

1. **Stack Management → Saved Objects → Import**
2. Import `data-view.ndjson` (creates the `.monitoring-es-*` data view)
3. Import `dashboard-skeleton.ndjson` (dashboard shell + method notes)
4. Resolve conflicts with **Overwrite** or **Skip** as appropriate for your site

Do **not** fetch these from the public internet. They live in this repository.

---

## 5. Create destination index template + put the combined watch

Open `kibana/watchers/ingest-watch-daily-combined.json` from the repo copy.

That file has three top-level keys:

| Key | Use |
|-----|-----|
| `metadata` | Operator notes (`watch_id`, `template_name`, dashboard version) — **do not** PUT this alone |
| `index_template` | Body for the index template API |
| `watch` | Body for the Watcher API |

### 5a. Index template

```http
PUT _index_template/ingest-watch-daily
```

Paste the **`index_template`** object from `ingest-watch-daily-combined.json` as the request body
(same content as `kibana/watchers/ingest-watch-daily-index.json`).

Optional first index:

```http
PUT ingest-watch-daily
```

### 5b. Combined watch

```http
PUT _watcher/watch/ingest-watch-daily-combined
```

Paste the **`watch`** object from `ingest-watch-daily-combined.json` as the request body
(same math/schedule as `ingest-watch-daily-internal.json`, watch id **`ingest-watch-daily-combined`** so it can coexist with the legacy watch).

Schedule: **01:15 UTC** (`0 15 1 * * ?`).

---

## 6. Execute once; verify `ingest-watch-daily`

Do not wait until 01:15 UTC:

```http
POST _watcher/watch/ingest-watch-daily-combined/_execute
{
  "record_execution": true
}
```

Verify documents:

```http
GET ingest-watch-daily/_search
{
  "size": 20,
  "sort": [{ "ingest_bytes": "desc" }],
  "query": { "term": { "scope": "cluster" } }
}
```

Watcher stats:

```http
GET _watcher/watch/ingest-watch-daily-combined/_stats
```

Expect at least one `scope: cluster` doc (`index_name: _cluster`) and many `scope: index` docs for the latest complete UTC day.

---

## 7. Create a data view for `ingest-watch-daily`

**Stack Management → Data Views → Create data view** (or Discover → create):

| Setting | Value |
|---------|-------|
| Name | `Ingest Watch daily` |
| Index pattern | `ingest-watch-daily` |
| Timestamp field | `@timestamp` |

Save. This is separate from the `.monitoring-es-*` data view imported in §4.

---

## 8. Build / use Lens panels on the dashboard

Open the imported dashboard skeleton (or create a new dashboard). Add **Lens** visualizations on data view **Ingest Watch daily**:

| Panel | Filter | Metric / breakdown |
|-------|--------|--------------------|
| KPI (cluster ingest) | `scope: cluster` | Sum (or Max) of `ingest_bytes` |
| Family stacked chart | `scope: index` | Sum `ingest_bytes`, break down by `stream_family` |
| Index table | `scope: index` | Sum `ingest_bytes` by `index_name` (sort desc) |

Time field is `@timestamp` (UTC day midnight). Use a Last 7 / 30 / 90 days range once the watch has run for several days.

**Path D Watcher + Lens is the recommended path.** You do **not** need an Elasticsearch transform or TSVB for this runbook. TSVB derivative on `.monitoring-es-*` remains an optional in-Kibana alternative (see `kibana/docs/tsvb-setup.md`) if you want charts without writing `ingest-watch-daily`.

---

## 9. Optional: deactivate the legacy watch

If `ingest-watch-daily-internal` was installed earlier, deactivate it so only the combined watch runs (both write the same destination index with the same `_id` scheme):

```http
PUT _watcher/watch/ingest-watch-daily-internal/_deactivate
```

Or delete:

```http
DELETE _watcher/watch/ingest-watch-daily-internal
```

Leave the combined watch active:

```http
GET _watcher/watch/ingest-watch-daily-combined
```

---

## 10. Verification checklist + common failures

### Checklist

- [ ] ES and Kibana same version ≥ 8.14.0
- [ ] `xpack.monitoring.collection.enabled` true
- [ ] `.monitoring-es-*` returns `type=index_stats` hits
- [ ] Saved objects imported from local copies of `objects/*.ndjson`
- [ ] `_index_template/ingest-watch-daily` exists
- [ ] Watch `ingest-watch-daily-combined` exists and `_execute` succeeded
- [ ] `ingest-watch-daily` has `scope:cluster` and `scope:index` docs
- [ ] Data view `Ingest Watch daily` uses `@timestamp`
- [ ] Lens KPI / family / table show data for complete UTC days

### Common failures

| Symptom | Likely cause |
|---------|----------------|
| No monitoring hits | Collection disabled; wait after enable; wrong privileges |
| Watch condition false / empty execute | No `index_stats` in last 4 complete days; check query in §3 |
| `security_exception` on PUT watch | Missing `manage_watcher` or index write privileges |
| Index mapping conflicts | Template not applied before first write; delete empty index and recreate template |
| KPI empty but index docs exist | Lens filter missing `scope: cluster`, or wrong data view |
| “Wrong” calendar day | Watch histogram uses **UTC**; change `time_zone` only if you need local calendar days |
| Duplicate cluster totals | Both legacy and combined watches active — deactivate one (§9) |

---

## 11. Explicitly out of scope

This runbook does **not** require and does **not** install:

- Elastic Agent / Fleet / Elastic Package Registry
- Metricbeat (or any Beat) downloaded from the internet
- The standalone React Ingest Watch UI (`src/`)
- The cluster bash script as a **required** path

The script `scripts/daily_ingest_from_monitoring.sh` remains an **optional offline backfill** (e.g. 30–90 days of history) if you have bash/curl/python3 on a host that can reach Elasticsearch. It is not needed to stand up the Kibana-only Path D dashboard.

Transforms (Path C) and TSVB (Path B) are optional alternatives documented under `kibana/docs/`; they are not mandatory for this air-gapped Kibana-only setup.

---

## Related docs

- Combined task file: `kibana/watchers/ingest-watch-daily-combined.json`
- Legacy single-watch steps: `kibana/docs/watcher-setup.md`
- Package overview: `kibana/README.md`
- Root air-gapped pin: `ONPREM.md`, `VERSION`
