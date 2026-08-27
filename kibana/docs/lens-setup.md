# Lens panels — match the React Ingest Watch dashboard

Use this after Watcher Path D has written `ingest-watch-daily` (`docs/watcher-setup.md` / `docs/kibana-only-airgapped-setup.md`).

Data view: **Ingest Watch daily**  
Pattern: `ingest-watch-daily`  
Time field: `@timestamp`

Same formula as the React app and the cluster script:

```
ingest_bytes = max(0, max_primary_store[day] − max_primary_store[day-1])
```

The Watcher already computed that field. Lens only **sums** it. Do not take a derivative of `ingest_bytes`.

## React → Lens map

| React panel | Lens type | KQL | Horizontal axis | Vertical / metric | Break down |
|-------------|-----------|-----|-----------------|-------------------|------------|
| KPI — period ingest | **Metric** | `scope: cluster` | — | Sum `ingest_bytes` | — |
| KPI — latest complete day | **Metric** | `scope: cluster` | — | Sum `ingest_bytes` | — |
| Daily ingest chart | **Bar** (vertical) | `scope: cluster` | Date histogram `@timestamp`, **1 day** | Sum `ingest_bytes` | — |
| Stacked by family | **Bar** stacked | `scope: index` | Date histogram `@timestamp`, **1 day** | Sum `ingest_bytes` | `stream_family` |
| Family share | **Donut** / pie | `scope: index` | — | Sum `ingest_bytes` | `stream_family` |
| Calendar heatmap | **Heatmap** | `scope: index` | Date histogram `@timestamp`, **1 day** | Sum `ingest_bytes` | `stream_family` |
| Index table | **Table** | `scope: index` | Rows: `index_name` | Sum `ingest_bytes` | optional `stream_family` |
| Hourly chart | *skip* | Watcher grain is **1 day**; no hourly series in this index | | | |

Number format: **Bytes**. Time picker: Last 7 / 30 / 90 days.

One `scope: cluster` document exists **per complete UTC day**. Sum and Max of `ingest_bytes` are the same for that filter.  
`scope: index` rows are per-index deltas; **never** mix `scope: cluster` into a family or index chart (that double-counts).

---

## Click path (Kibana 8.18)

Dashboard: **Analytics → Dashboard → Ingest Watch (Kibana · internal)**  
Time range: **Last 30 days**. For each panel: **Add panel → Lens**.

### 1. Period ingest KPI (React KPI row)

1. Visualization type: **Metric**.
2. Data view: `Ingest Watch daily`.
3. Drag `ingest_bytes` → metric. Function: **Sum**.
4. Format: **Bytes**.
5. Add filter: `scope: cluster`.
6. Title: `Period ingest`.
7. **Save and return**.

The dashboard time picker is the period (same as React 7/14/30/90). The latest bucket is the last complete UTC day the watch wrote.

### 2. Daily ingest (React daily chart)

1. Type: **Bar vertical**.
2. Horizontal axis: `@timestamp` → Date histogram → **1 day**.
3. Vertical axis: Sum `ingest_bytes`.
4. Filter: `scope: cluster`.
5. Format: Bytes.
6. Title: `Daily cluster ingest`.
7. Save and return. Full width.

### 3. Stacked by family (React stacked series)

1. Type: **Bar vertical**.
2. Horizontal: `@timestamp` → 1 day.
3. Vertical: Sum `ingest_bytes`.
4. Break down by: `stream_family` (Top values, size 10).
5. Bar layout: **Stacked**.
6. Filter: `scope: index` (**not** cluster).
7. Title: `Daily ingest by family`.
8. Save and return.

Families: `logs`, `metrics`, `kafka`, `apm`, `system`, `other`.

### 4. Family share (React family-share)

1. Type: **Donut** (or pie).
2. Slice by: `stream_family`.
3. Metric: Sum `ingest_bytes`.
4. Filter: `scope: index`.
5. Title: `Family share`.
6. Save and return.

### 5. Calendar-style heatmap (React calendar)

True month-grid calendar is not a Lens chart type. Closest native match:

1. Type: **Heatmap**.
2. Horizontal: `@timestamp` → 1 day.
3. Vertical: `stream_family`.
4. Cell value: Sum `ingest_bytes`.
5. Filter: `scope: index`.
6. Title: `Daily ingest heatmap`.
7. Save and return.

### 6. Index table (React index table)

1. Type: **Table**.
2. Rows: `index_name` (Top values, size 50–200).
3. Metrics: Sum `ingest_bytes` (Bytes). Optional: Sum `max_primary_bytes`, Sum `max_docs`.
4. Filter: `scope: index`.
5. Sort metric descending.
6. Title: `Ingest by index`.
7. Save and return. Full width under the charts.

---

## Filters you must not mix

| Filter | Meaning |
|--------|---------|
| `scope: cluster` | One rollup doc per day. Use for KPI + daily bar only. |
| `scope: index` | One doc per index per day. Use for family / table / heatmap. |
| `index_name: _cluster` | Same as `scope: cluster`. |

Do **not** chart `.monitoring-es-*` in these Lens panels. That index is a **gauge** of primary store size, not ingest.

---

## After import of the fixed skeleton (#3)

`objects/dashboard-skeleton.ndjson` now uses panel type **`visualization`** with a markdown *visualization*, not panel type `markdown`.

Kibana 8.18.4 has **no embeddable factory** for dashboard panel type `markdown`. Re-import the updated NDJSON (**Overwrite**).

---

## If Lens is empty

1. `GET ingest-watch-daily/_count` — must be > 0.
2. Watch `_execute` action `index_each` must be `success` (issue #2).
3. Data view timestamp is `@timestamp`, not `timestamp`.
4. Time picker includes complete UTC days the watch wrote (today excluded).
5. First `_execute` writes **one** complete day; 30-day charts fill after 01:15 UTC daily runs.
