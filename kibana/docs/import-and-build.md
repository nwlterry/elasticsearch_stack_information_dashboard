# Import and build checklist (Kibana 8.18)

## 1. Import (required order)

**Stack Management -> Saved Objects -> Import**

1. `objects/data-view-ingest-watch-daily.ndjson` (create first so Lens refs resolve)
2. `objects/dashboard-skeleton.ndjson` (Overwrite). Includes method note + Lens panels.
3. Optional: `objects/data-view.ndjson` for `.monitoring-es-*`

Method note is ASCII only (no em-dash / minus / multiply glyphs). Title is `Ingest Watch (Kibana - internal)`.

Imported Lens panels (data view `Ingest Watch daily`):

- Period ingest (metric, scope: cluster)
- Daily cluster ingest (bar, 1d)
- Daily ingest by family (stacked bar)
- Family share (donut)
- Daily ingest heatmap
- Ingest by index (table)

Watcher must have written `ingest-watch-daily` or panels are empty.

## 2. Open

**Analytics -> Dashboard -> Ingest Watch (Kibana - internal)**

Time range last 30 days. If a Lens panel says missing data view, import the data-view NDJSON first, then re-import the dashboard with Overwrite.

## 3. Optional TSVB

`tsvb-setup.md` only if Watcher cannot run.

## Parity

Same ingest field as the React app. Hourly chart is not imported (Watcher is daily).
