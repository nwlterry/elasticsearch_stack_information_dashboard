# On-prem air-gapped version

**Dashboard 1.0.3** for self-managed Elasticsearch **without internet**.

| Pin | Value |
|---|---|
| Dashboard | 1.0.3 |
| Elasticsearch | **8.14.0** minimum, verified **8.18.4** |
| Also supported | 8.14–8.18 and 9.x |
| Kibana | Same version as Elasticsearch |
| Collection | Internal (built-in) or Metricbeat xpack |
| Index | `.monitoring-es-*` |
| Query | `queries/daily_ingest_internal.json` |
| Script | `scripts/daily_ingest_from_monitoring.sh` (1.0.1+ temp-file parse) |
| Host tools | bash, curl, python3 ≥ 3.6 |
| Kibana (optional) | `kibana/` — TSVB, ES|QL, Watcher Path D |
| **Kibana-only path** | [`kibana/docs/kibana-only-airgapped-setup.md`](kibana/docs/kibana-only-airgapped-setup.md) |

No Elastic Agent, Fleet, or package registry is required.

## Enable internal collection

```
PUT _cluster/settings
{
  "persistent": {
    "xpack.monitoring.collection.enabled": true
  }
}
```

## Run on a host that can reach Elasticsearch

```bash
export ES_URL=https://es.example.com:9200
export ES_API_KEY='...'
export ES_COLLECTION=internal
chmod +x scripts/daily_ingest_from_monitoring.sh
./scripts/daily_ingest_from_monitoring.sh 30 UTC
```

Or in Kibana Dev Tools, run `queries/daily_ingest_internal.json` against `.monitoring-es-*`.

## If Kibana is already on the network

**Preferred Kibana-only air-gapped path:** [`kibana/docs/kibana-only-airgapped-setup.md`](kibana/docs/kibana-only-airgapped-setup.md) — Saved Objects Import + combined Watcher task (`kibana/watchers/ingest-watch-daily-combined.json`) + Lens. No Agent/Fleet, no internet downloads, React UI and bash script not required (script optional for offline backfill).

Also see `UPDATES.md` and `kibana/README.md`.

- Fast charts: TSVB derivative (`kibana/docs/tsvb-setup.md`) — optional
- Exact Lens field: Watcher Path D (`kibana/docs/watcher-setup.md`) writes `ingest-watch-daily` — **recommended** via the combined task file

Watcher and transform write new indices. The script and Dev Tools query do not.

## Copy to an air-gapped site

Copy the repo (or the release zip plus the `kibana/` tree from main) onto an isolated host. The script path does not need Node.js or npm. The Kibana-only path needs only the `kibana/` tree copied onto a host that can open Kibana.

Internal monitoring is removed in Elasticsearch **10.0**. Stay on 8.x or 9.x for this path.
