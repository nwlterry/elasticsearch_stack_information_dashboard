# Import and build checklist (Kibana 8.18)

## 1. Import skeleton

**Stack Management → Saved Objects → Import**

- `objects/data-view.ndjson`
- `objects/dashboard-skeleton.ndjson`

If the data view already exists for `.monitoring-es-*`, skip or overwrite carefully.

## 2. Open the dashboard

**Analytics → Dashboard → Ingest Watch (Kibana · internal)**

You should see the method markdown panel and a default KQL filter `type: index_stats`.

## 3. Add TSVB visualizations (Path B)

Follow `tsvb-setup.md` and add panels to this dashboard:

1. Cluster daily ingest (time series)  
2. Top indices table  
3. Period KPI metric  

Save each to the Visualize Library, then **Add from library** on the dashboard.

## 4. Optional runtime field

Add `stream_family` per `runtime-family.md` on the data view, then create a stacked bar broken down by family (after you have a workable ingest metric).

## 5. Optional transform

```bash
# From a host that can reach Elasticsearch
curl -sS -u elastic -H 'Content-Type: application/json' \
  -X PUT "$ES_URL/_transform/monitoring-daily-index-store-max" \
  -d @transforms/daily_index_store_max.json

curl -sS -u elastic -X POST "$ES_URL/_transform/monitoring-daily-index-store-max/_start"
```

Create a second data view on `monitoring-ingest-daily` for peak-size tables.

## 6. Spaces / roles

Put the dashboard in the observability space. Role needs read on `.monitoring-es-*` and the dashboard objects.

## Parity note

The React app's full UX (paste JSON, family toggles, calendar) will not appear as a single import. This package gives **native Kibana** access to the **same metric definition** for internal collection on your 8.18 cluster.
