# Path C — Transform for durable daily store peaks

Materialize one row per `(day, index_name)` with max primary store size.

## Destination mapping (optional)

```http
PUT monitoring-ingest-daily
{
  "mappings": {
    "properties": {
      "day": { "type": "date" },
      "index_name": { "type": "keyword" },
      "max_primary_bytes": { "type": "long" },
      "max_docs": { "type": "long" },
      "stream_family": { "type": "keyword" }
    }
  }
}
```

## Create pivot transform

```http
PUT _transform/monitoring-daily-index-store-max
{ ... body from transforms/daily_index_store_max.json ... }

POST _transform/monitoring-daily-index-store-max/_start
```

For production on 8.18.4: **Path B (TSVB)** for ingest charts + this transform for peak-size tables. Exact lag-per-index is not available in a single pivot; use TSVB Derivative or the cluster script.
