# Path B — TSVB panels (internal collection)

Build these in **Dashboard → Create visualization → TSVB** (or Visualize Library).

## Shared settings

- **Index pattern / data view**: `.monitoring-es-*` (timestamp: `timestamp`)
- **Panel filter**: `type: index_stats`
- **Interval**: `1d` (or `>=1d` auto)
- **Drop last bucket**: enabled (partial day)
- **Time range**: last 30 or 90 days

## Panel 1 — Cluster daily ingest (primary store delta)

1. Chart type: **Time Series**  
2. Metric: Aggregation **Max**, field `index_stats.primaries.store.size_in_bytes`  
3. Group by: **Terms**, field `index_stats.index`, size `500` (or `800`)  
4. Series aggregation: **Derivative**, units `1d`  
5. Options: **Positive Only** = yes (same as `max(0, delta)`)  
6. Data formatter: Bytes  
7. Prefer **grouped by index** then sum series (per-index day-over-day, then cluster sum).

## Panel 2 — Top indices by ingest (table)

1. Chart type: **Table**  
2. Same Max → group by `index_stats.index` → Derivative → Positive Only  
3. Sort by the derivative column descending  

## Panel 3 — KPI (period total)

1. Chart type: **Metric**  
2. Same series as Panel 1 with **Sum** over the selected time range of positive derivatives  

## Caveats

- First bucket in the window has no previous point → large spike (same as the shell script).  
- Terms size must cover your active index count or top-N will under-count.  
- Runtime field `stream_family` enables stacked bars by family (see `runtime-family.md`).
