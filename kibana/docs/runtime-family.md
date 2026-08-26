# Runtime field: stream family

Optional runtime field on the data view to approximate the React app family breakdown.

**Data view → Mapping → Add field → Runtime**

- Name: `stream_family`
- Type: keyword
- Script (Painless):

```
String n = '';
if (doc.containsKey('index_stats.index') && doc['index_stats.index'].size() != 0) {
  n = doc['index_stats.index'].value.toLowerCase();
} else if (doc.containsKey('index_name') && doc['index_name'].size() != 0) {
  n = doc['index_name'].value.toLowerCase();
}
if (n.contains('.monitoring') || n.contains('stack_monitoring') || n.contains('.kibana')
    || n.contains('.security') || n.contains('.watcher') || n.contains('.tasks')
    || n.contains('.async-search') || n.contains('.fleet') || n.contains('elastic_agent')) {
  emit('system');
} else if (n.contains('apm') || n.contains('traces-') || n.contains('span') || n.contains('transaction')) {
  emit('apm');
} else if (n.contains('kafka') || n.contains('connect')) {
  emit('kafka');
} else if (n.contains('metric') || n.contains('prometheus') || n.contains('prom-') || n.contains('vsphere')) {
  emit('metrics');
} else if (n.contains('logs-') || n.contains('filebeat') || n.contains('winlog')
    || n.contains('syslog') || n.contains('fluent') || n.contains('vector')
    || n.contains('iis') || n.contains('openshift') || n.contains('audit')) {
  emit('logs');
} else {
  emit('other');
}
```
