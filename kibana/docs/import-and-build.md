# Import and build checklist (Kibana 8.18)

## 1. Import order (Overwrite)

**Stack Management -> Saved Objects -> Import**

1. `objects/data-view-ingest-watch-daily.ndjson`
2. `objects/lens-visualizations.ndjson` (classic visualizations: metric, histogram, pie, heatmap, table)
3. `objects/dashboard-skeleton.ndjson`

Do not keep the previous Lens library objects (`iw-*` type lens). Overwrite them with this file. Hand-built Lens NDJSON is not accepted as a visualization type on this 8.18.4 cluster (`Visualization type not found`).

Method note is ASCII only.

## 2. Open

**Analytics -> Dashboard -> Ingest Watch (Kibana - internal)**

Time range last 30 days. Watcher must have written `ingest-watch-daily`.

## 3. If an old Lens panel still says type not found

Delete saved objects titled Period ingest / Daily cluster ingest / ... of type **lens**, then re-import step 2 and 3.
