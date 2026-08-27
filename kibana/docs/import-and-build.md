# Import and build checklist (Kibana 8.18)

## Format

All size fields use Lens / data-view **Bytes** with numeral pattern `0.00b` (base **1024**).
Values auto-scale: B, KB, MB, GB, TB.

Applied on:
- Data view `Ingest Watch daily` field formats: `ingest_bytes`, `max_primary_bytes`, `prev_primary_bytes`
- Each Lens metric column: `params.format.id = bytes`, `pattern = 0.00b`

## Import order (Overwrite)

**Stack Management -> Saved Objects -> Import**

1. `objects/data-view-ingest-watch-daily.ndjson`
2. `objects/lens-visualizations.ndjson` (type **lens**, same ids `iw-*`)
3. `objects/dashboard-skeleton.ndjson`

Delete leftover **visualization** objects with the same titles if Overwrite does not replace type visualization -> lens.

## Open

**Analytics -> Dashboard -> Ingest Watch (Kibana - internal)**

Time range last 30 days. Requires `ingest-watch-daily` documents from Watcher.
