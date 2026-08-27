# Import and build checklist (Kibana 8.18)

## 1. Import skeleton

**Stack Management → Saved Objects → Import**

- `objects/data-view-ingest-watch-daily.ndjson` — Lens data view (`ingest-watch-daily`, `@timestamp`)
- `objects/data-view.ndjson` — optional `.monitoring-es-*` view
- `objects/dashboard-skeleton.ndjson` — dashboard shell

If an older skeleton is already imported, choose **Overwrite**.

The method panel is type **`visualization`** (markdown vis). Panel type `markdown` is not registered on 8.18.4 and fails with `No embeddable factory found for type: markdown` (issue #3).

## 2. Open the dashboard

**Analytics → Dashboard → Ingest Watch (Kibana · internal)**

You should see the method note (React ↔ Lens map). Time range defaults to last 30 days.

## 3. Add Lens panels (Path D — recommended)

Watcher must have written `ingest-watch-daily` first.

Follow **`docs/lens-setup.md`** so the Kibana dashboard matches the React Ingest Watch app:

1. Period KPI — Metric, `scope: cluster`, Sum `ingest_bytes`
2. Daily bar — `@timestamp` 1d, `scope: cluster`
3. Stacked family — `scope: index`, break down `stream_family`
4. Family donut — `scope: index`
5. Heatmap — closest native calendar
6. Index table — `index_name` + Sum `ingest_bytes`

## 4. Optional TSVB (Path B, no Watcher index)

Follow `tsvb-setup.md` only if you cannot run Watcher. That path approximates ingest from `.monitoring-es-*` and will not match the React numbers as closely as Path D.

## 5. Optional runtime field on `.monitoring-es-*`

Add `stream_family` per `runtime-family.md` only for TSVB/ES|QL on monitoring indices. Path D already stores `stream_family` on `ingest-watch-daily`.

## 6. Spaces / roles

Put the dashboard in the observability space. Role needs `read` on `ingest-watch-daily` and the saved objects. Watcher write privileges are only for the account that PUT/_execute the watch.

## Parity note

The React app (paste JSON, range toggles, true calendar grid) is not an importable Kibana object. This package gives **native Kibana Lens** panels on the **same ingest field** the React app computes.
