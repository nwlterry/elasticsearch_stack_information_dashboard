# On-prem air-gapped version

**Dashboard 1.0.1** for self-managed Elasticsearch **without internet**.

| Pin | Value |
|---|---|
| Dashboard | 1.0.1 |
| Elasticsearch | **8.14.0** minimum, verified **8.18.4** |
| Also supported | 8.14–8.18 and 9.x |
| Kibana | Same version as Elasticsearch |
| Collection | Internal (built-in) or Metricbeat xpack |
| Index | `.monitoring-es-*` |
| Query | `queries/daily_ingest_internal.json` |
| Script | `scripts/daily_ingest_from_monitoring.sh` |
| Host tools | bash, curl, python3 ≥ 3.6 |

No Elastic Agent, Fleet, or package registry is required.

## Enable internal collection

```
PUT _cluster/settings
{
  "persistent": {
    "xpack.monitoring.collection.enabled": true
  }
}
```

## Run on a host that can reach Elasticsearch

```bash
export ES_URL=https://es.example.com:9200
export ES_API_KEY='...'
export ES_COLLECTION=internal
chmod +x scripts/daily_ingest_from_monitoring.sh
./scripts/daily_ingest_from_monitoring.sh 30 UTC
```

Or in Kibana Dev Tools, run `queries/daily_ingest_internal.json` against `.monitoring-es-*`.

## Copy to an air-gapped site

Download the on-prem zip from the [v1.0.1 release](https://github.com/nwlterry/elasticsearch_stack_information_dashboard/releases/tag/v1.0.1) on a connected machine, then copy it in. The zip contains `VERSION`, this runbook, the three queries, and the script. It does not need Node.js or npm.

Internal monitoring is removed in Elasticsearch **10.0**. Stay on 8.x or 9.x for this path.
