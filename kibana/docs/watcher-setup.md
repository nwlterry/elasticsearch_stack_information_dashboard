# Path D — Watcher → Lens (exact ingest math)

Materialize **yesterday’s** per-index ingest into `ingest-watch-daily`, then chart with **Lens** (no TSVB derivative).

Same formula as the cluster script and the React app:

```
ingest = max(0, max_primary_store[day] − max_primary_store[day-1])
```

Internal collection only: `.monitoring-es-*`, `type=index_stats`.

## What the watch writes

Index: `ingest-watch-daily`  
Schedule: `01:15 UTC` daily (`0 15 1 * * ?`)  
Window: last 4 complete calendar days; **only the latest complete day** is indexed (idempotent `_id` = `{day}|{index_name}`).

| `scope` | `index_name` | Meaning |
|---------|--------------|---------|
| `index` | real index name | Per-index ingest for that day |
| `cluster` | `_cluster` | Sum of per-index deltas (use this for the KPI / daily bar) |

Fields: `day`, `ingest_bytes`, `max_primary_bytes`, `max_docs`, `stream_family`, `collection=internal`, `source=watcher`.

Reruns overwrite the same `_id`. First-seen index that day uses full primary size (same as the script).

## 1. Privileges

- Cluster: `manage_watcher`, `monitor`
- `.monitoring-es-*`: `read`, `view_index_metadata`
- `ingest-watch-daily`: `create_index`, `index`, `write`, `view_index_metadata`

Watcher is in the default self-managed 8.x distribution (Gold/Platinum not required).

## 2. Create the destination template

```http
PUT _index_template/ingest-watch-daily
```

Body: `watchers/ingest-watch-daily-index.json`

Optional first index:

```http
PUT ingest-watch-daily
```

## 3. Put the watch

```http
PUT _watcher/watch/ingest-watch-daily-internal
```

Body: `watchers/ingest-watch-daily-internal.json`

## 4. Execute once (do not wait until 01:15)

```http
POST _watcher/watch/ingest-watch-daily-internal/_execute
{
  "record_execution": true
}
```

Check:

```http
GET ingest-watch-daily/_search
{
  "size": 20,
  "sort": [{ "ingest_bytes": "desc" }],
  "query": { "term": { "scope": "cluster" } }
}
```

```http
GET _watcher/watch/ingest-watch-daily-internal/_stats
```

## 5. Lens data view

- Name: `Ingest Watch daily`
- Pattern: `ingest-watch-daily`
- Time field: `@timestamp`

- KPI / daily bar: `scope: cluster` → Sum (or Max) of `ingest_bytes`
- Stacked family: `scope: index` → Sum `ingest_bytes` by `stream_family`
- Index table: `scope: index` → Sum `ingest_bytes` by `index_name`

## 6. History / backfill

The watch only writes the latest complete day. For 30–90 days:

```bash
export ES_COLLECTION=internal
./scripts/daily_ingest_from_monitoring.sh 30 UTC
```

## 7. Disable / delete

```http
PUT _watcher/watch/ingest-watch-daily-internal/_deactivate
DELETE _watcher/watch/ingest-watch-daily-internal
```

## Caveats

- Histogram time zone is **UTC**. Change `time_zone` for `Asia/Macau` calendar days.
- Terms size is 800. `foreach.max_iterations` is 1000.
- Partial today is excluded (`lt: now/d`).
- Watcher does **not** enable `xpack.monitoring.collection.enabled`.
