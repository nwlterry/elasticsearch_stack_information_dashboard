# Changelog

All notable updates to [nwlterry/elasticsearch_stack_information_dashboard](https://github.com/nwlterry/elasticsearch_stack_information_dashboard).

## 1.0.3 — 2026-08-27

Combined Watcher task for operators + full Kibana-only air-gapped setup guide.

### Added

- `kibana/watchers/ingest-watch-daily-combined.json` — packages the `ingest-watch-daily` index template and the daily watch in one file (watch id `ingest-watch-daily-combined`; can coexist with legacy `ingest-watch-daily-internal`).
- `kibana/docs/kibana-only-airgapped-setup.md` — operator runbook using only Kibana UI / Dev Tools (no Agent/Fleet, no internet downloads, no React UI; bash script optional for offline backfill only).

### Changed

- `kibana/docs/watcher-setup.md` recommends the combined task; keeps legacy single-watch steps.
- `kibana/README.md`, root `README.md`, `ONPREM.md`, `UPDATES.md`, and `VERSION` point at the combined Watcher and the Kibana-only guide.
- Dashboard pin bumped to **1.0.3**.

### Not changed

- Existing `ingest-watch-daily-index.json` and `ingest-watch-daily-internal.json` are kept unchanged.
- Ingest formula remains `max(0, primary_store[day] − primary_store[day-1])`.
- Schedule remains 01:15 UTC; same family() Painless, foreach index action, and fields written to `ingest-watch-daily`.

---

## 1.0.2 — 2026-08-27

Organized release: Kibana-native package + Watcher Path D, plus cleanup of on-prem docs.

### Added

- `kibana/` package for **internal collection** (`.monitoring-es-*`, `type=index_stats`):
  - Path A — ES|QL peak-store queries
  - Path B — TSVB derivative (approximate ingest)
  - Path C — pivot transform `monitoring-ingest-daily` (peak store)
  - Path D — Watcher → `ingest-watch-daily` (exact ingest for Lens)
- Importable objects: data view + dashboard skeleton
- Watcher index template and watch body
- Runtime field recipe `stream_family`
- This changelog and an updated repo layout in `README.md`

### Changed

- Root `README.md` now lists the Kibana package and Watcher next to the standalone app and the cluster script.
- `VERSION` deduplicated; pin remains ES **8.14.0+** / verified **8.18.4**.
- `ONPREM.md` points at the Kibana/Watcher path for clusters that already run Kibana on-network.

### Not changed

- Ingest formula is still `max(0, primary_store[day] − primary_store[day-1])`.
- Script `scripts/daily_ingest_from_monitoring.sh` remains the air-gapped CLI (use **1.0.1+** so large responses do not hit `Argument list too long`).

---

## 1.0.1 — 2026-08-26

On-prem / air-gapped pin and script ARG_MAX fix.

### Added

- `VERSION` pin file
- `ONPREM.md` air-gapped runbook
- Release zip intended for copy onto isolated RHEL 8 hosts

### Fixed

- `scripts/daily_ingest_from_monitoring.sh`: curl writes the search response to a temp file; Python reads the file. Passing the JSON on argv caused `/usr/bin/python3: Argument list too long` on multi-index clusters.

---

## 1.0.0 — 2026-08-26

First published snapshot.

### Added

- Standalone **Ingest Watch** UI (React 19 / TanStack Start) for ES **8.14.0+**
- Unified runtime-mapping query for mixed internal + Agent sources
- Internal and Agent-only Dev Tools queries
- Cluster script (initial argv-based parser)
- Demo dataset modeled on a 16-node 8.18.4 observability cluster
