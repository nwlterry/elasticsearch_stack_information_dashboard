# Updates — organized index (dashboard 1.0.2)

Single map of what this repo now contains. Ingest formula is unchanged everywhere:

```
ingest = max(0, max(primary store bytes)[day] − max(primary store bytes)[day-1])
```

Internal collection = `.monitoring-es-*` + `type=index_stats`. Replicas excluded.

## Three ways to use it

| Use this | When | Writes to cluster? |
|----------|------|--------------------|
| **A. Cluster script** `scripts/daily_ingest_from_monitoring.sh` | Air-gapped host, CLI table, backfill 30–90 days | No (read-only search) |
| **B. Standalone Ingest Watch UI** | Demo, paste Dev Tools JSON, or live public ES URL | No |
| **C. Kibana package** `kibana/` | Kibana already on the private network | Only Path D Watcher / Path C transform |

## What landed in each version

| Version | Date | What |
|---------|------|------|
| 1.0.0 | 2026-08-26 | React dashboard, 8.14 unified + internal + Agent queries, first script |
| 1.0.1 | 2026-08-26 | On-prem pin, `ONPREM.md`, script temp-file parse (fixes `Argument list too long`) |
| 1.0.2 | 2026-08-27 | Kibana-native package, Watcher Path D, this index, cleaned `VERSION` |

## File map

### On-prem / CLI

| Path | Role |
|------|------|
| `VERSION` | Pins: dashboard 1.0.2, ES 8.14.0+ / verified 8.18.4 |
| `ONPREM.md` | Air-gapped runbook |
| `CHANGELOG.md` | Version history |
| `queries/daily_ingest_internal.json` | Dev Tools body for `.monitoring-es-*` |
| `queries/daily_ingest_8.14_unified.json` | Mixed internal + Agent |
| `queries/daily_ingest_agent.json` | Agent data stream only |
| `scripts/daily_ingest_from_monitoring.sh` | CLI table (`ES_COLLECTION=internal`) |

### Kibana (internal)

| Path | Role |
|------|------|
| `kibana/README.md` | Paths A–D |
| `kibana/docs/watcher-setup.md` | **Recommended Lens path** |
| `kibana/docs/tsvb-setup.md` | TSVB derivative (no extra index) |
| `kibana/docs/transform-setup.md` | Daily peak-store transform |
| `kibana/docs/runtime-family.md` | `stream_family` Painless |
| `kibana/docs/import-and-build.md` | Import checklist |
| `kibana/esql/*.esql` | Discover peak-store queries |
| `kibana/objects/*.ndjson` | Data view + dashboard shell |
| `kibana/watchers/ingest-watch-daily-index.json` | Template for `ingest-watch-daily` |
| `kibana/watchers/ingest-watch-daily-internal.json` | Daily watch (01:15 UTC) |
| `kibana/transforms/daily_index_store_max.json` | Pivot transform |
| `kibana/queries/daily_ingest_internal.json` | Copy of the internal query |

### Standalone UI

| Path | Role |
|------|------|
| `src/components/dashboard/` | Ingest Watch screens |
| `src/lib/es-queries.ts` | Query bodies + 8.14 runtime mappings |
| `src/lib/ingest.ts` | Day-over-day math |
| `src/lib/version.ts` | `MIN_ES_VERSION=8.14.0` |

## Operator recipes

### Air-gapped table (no Kibana objects)

```bash
export ES_URL=https://es.example.com:9200
export ES_API_KEY='...'
export ES_COLLECTION=internal
./scripts/daily_ingest_from_monitoring.sh 30 UTC
```

Use script from **1.0.1+**.

### Private cluster → standalone UI

1. Dev Tools against `.monitoring-es-*` with `queries/daily_ingest_internal.json`
2. Connect → Paste JSON

Live connect only works if Elasticsearch is reachable from the app (not RFC1918 from the hosted preview).

### Private cluster → Kibana Lens (exact ingest)

1. `PUT _index_template/ingest-watch-daily` ← `kibana/watchers/ingest-watch-daily-index.json`
2. `PUT _watcher/watch/ingest-watch-daily-internal` ← `kibana/watchers/ingest-watch-daily-internal.json`
3. `POST _watcher/watch/ingest-watch-daily-internal/_execute`
4. Data view `ingest-watch-daily`
   - KPI: `scope: cluster` / `ingest_bytes`
   - Family / table: `scope: index`

Details: `kibana/docs/watcher-setup.md`.

## What nothing in this repo does

- Does not enable `xpack.monitoring.collection.enabled` for you (do that once).
- Does not install Elastic Agent / Fleet.
- Does not change ILM, shards, or data-tier settings.
- Does not import a finished Lens visualization library (skeleton + recipes only).
- Internal collection is removed in Elasticsearch **10.0**; stay on 8.x / 9.x for this path.
