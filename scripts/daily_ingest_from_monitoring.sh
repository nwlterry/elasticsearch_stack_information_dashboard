#!/usr/bin/env bash
# Daily Elasticsearch ingest from Stack Monitoring (ES 8.14.0+)
#
# Computes day-over-day increase of primaries store size (floored at 0).
#
# Usage:
#   export ES_URL=https://es.example.com:9200
#   export ES_API_KEY='base64-id-key'          # preferred
#   # or: export ES_USER=elastic ES_PASSWORD=...
#   # Air-gapped on-prem (no Elastic Agent / no internet):
#   export ES_COLLECTION=internal
#   ./scripts/daily_ingest_from_monitoring.sh [days] [timezone]
#
# Defaults: 30 days, UTC
# ES_COLLECTION: auto (unified 8.14) | internal | agent
# Index pattern:
#   auto     .monitoring-es-*,metrics-elasticsearch.stack_monitoring.index-*
#   internal .monitoring-es-*
#   agent    metrics-elasticsearch.stack_monitoring.index-*

set -euo pipefail

DAYS="${1:-30}"
TZ_NAME="${2:-UTC}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COLLECTION="${ES_COLLECTION:-auto}"

case "$COLLECTION" in
  internal)
    DEFAULT_PATTERN=".monitoring-es-*"
    QUERY_FILE="$ROOT/queries/daily_ingest_internal.json"
    ;;
  agent|beats)
    DEFAULT_PATTERN="metrics-elasticsearch.stack_monitoring.index-*"
    QUERY_FILE="$ROOT/queries/daily_ingest_agent.json"
    ;;
  auto|unified|*)
    DEFAULT_PATTERN=".monitoring-es-*,metrics-elasticsearch.stack_monitoring.index-*"
    QUERY_FILE="$ROOT/queries/daily_ingest_8.14_unified.json"
    ;;
esac

PATTERN="${ES_MONITORING_PATTERN:-$DEFAULT_PATTERN}"

if [[ -z "${ES_URL:-}" ]]; then
  echo "ES_URL is required" >&2
  exit 1
fi

if [[ ! -f "$QUERY_FILE" ]]; then
  echo "Query file not found: $QUERY_FILE" >&2
  exit 1
fi

echo "dashboard=1.0.0 es_min=8.14.0 collection=${COLLECTION} pattern=${PATTERN} query=$(basename "$QUERY_FILE")" >&2

AUTH=()
if [[ -n "${ES_API_KEY:-}" ]]; then
  AUTH=(-H "Authorization: ApiKey ${ES_API_KEY}")
elif [[ -n "${ES_USER:-}" && -n "${ES_PASSWORD:-}" ]]; then
  AUTH=(-u "${ES_USER}:${ES_PASSWORD}")
else
  echo "Set ES_API_KEY or ES_USER+ES_PASSWORD" >&2
  exit 1
fi

BODY=$(python3 - "$QUERY_FILE" "$DAYS" "$TZ_NAME" <<'PY'
import json, sys
path, days, tz = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
    body = json.load(f)

def patch(node):
    if isinstance(node, list):
        for item in node:
            patch(item)
        return
    if not isinstance(node, dict):
        return
    if "range" in node and isinstance(node["range"], dict):
        for field in list(node["range"].keys()):
            node["range"][field] = {"gte": f"now-{int(days)+1}d/d", "lte": "now"}
    if "date_histogram" in node and isinstance(node["date_histogram"], dict):
        node["date_histogram"]["time_zone"] = tz
    for v in node.values():
        patch(v)

patch(body)
json.dump(body, sys.stdout)
PY
)

ENCODED_PATTERN=$(python3 -c "import urllib.parse,sys; print(','.join(urllib.parse.quote(p, safe='*-.') for p in sys.argv[1].split(',')))" "$PATTERN")

RESP=$(curl -sS -X POST "${ES_URL}/${ENCODED_PATTERN}/_search?ignore_unavailable=true&allow_no_indices=true" \
  -H "Content-Type: application/json" \
  "${AUTH[@]}" \
  -d "$BODY")

python3 - <<'PY' "$RESP"
import json, sys
raw = sys.argv[1]
data = json.loads(raw)
if "error" in data:
    print(json.dumps(data["error"], indent=2))
    sys.exit(1)
indices = data.get("aggregations", {}).get("indices", {}).get("buckets", [])
print(f"{'date':<12} {'index':<48} {'store_max_bytes':>16} {'docs_max':>12}")
rows = []
for idx in indices:
    name = idx.get("key", "")
    for day in idx.get("by_day", {}).get("buckets", []):
        date = (day.get("key_as_string") or "")[:10]
        size = (day.get("max_size") or {}).get("value") or 0
        docs = (day.get("max_docs") or {}).get("value") or 0
        rows.append((name, date, size, docs))

# day-over-day ingest per index
from collections import defaultdict
series = defaultdict(list)
for name, date, size, docs in rows:
    series[name].append((date, size, docs))

ingest = defaultdict(float)
for name, points in series.items():
    points.sort()
    prev = None
    for date, size, docs in points:
        delta = size if prev is None else max(0.0, size - prev)
        ingest[date] += delta
        prev = size

print("--- daily cluster ingest (primary store delta, 8.14.0+) ---")
print(f"{'date':<12} {'bytes':>16} {'GiB':>10}")
for date in sorted(ingest):
    b = ingest[date]
    print(f"{date:<12} {int(b):>16} {b/1024**3:10.2f}")
PY
