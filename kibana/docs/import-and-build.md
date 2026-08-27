# Import and build checklist (Kibana 8.18)

## Format

All size values use **Bytes** with numeral pattern `0.00b` (base **1024**).
Auto-scale: B, KB, MB, GB, TB (example: 2000 -> 1.95KB, 1073741824 -> 1.00GB).

Set on:
- Data view field formats for `ingest_bytes`, `max_primary_bytes`, `prev_primary_bytes`
- Each Lens Sum column: format id `bytes`, pattern `0.00b`

In Lens UI this is Value format -> Bytes (not the 1000 / `bd` decimal formatter).

## Import order (Overwrite)

**Stack Management -> Saved Objects -> Import**

1. `objects/data-view-ingest-watch-daily.ndjson`
2. `objects/lens-visualizations.ndjson` (Period ingest, Daily cluster ingest, Daily ingest by family)
3. `objects/lens-visualizations-more.ndjson` (Family share, heatmap, index table)
4. `objects/dashboard-skeleton.ndjson`

If old objects named `iw-*` are type **visualization**, delete them first so they can be recreated as type **lens**.

## Open

**Analytics -> Dashboard -> Ingest Watch (Kibana - internal)**

Last 30 days. Requires Watcher data in `ingest-watch-daily`.
