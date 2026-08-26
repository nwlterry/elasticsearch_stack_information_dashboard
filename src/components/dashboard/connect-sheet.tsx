import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchMonitoringIngest } from "@/lib/es.functions";
import { parsePastedMonitoring } from "@/lib/parse-monitoring";
import { DEFAULT_MONITORING_PATTERN } from "@/lib/es-queries";
import type { ConnectionConfig, DataMode, MonitoringDataset, RangeDays } from "@/lib/types";

const PATTERN_INTERNAL = ".monitoring-es-*";
const PATTERN_BEATS = "metrics-elasticsearch.stack_monitoring.index-*";

export function ConnectSheet({
  open,
  onOpenChange,
  connection,
  onConnectionChange,
  rangeDays,
  onDataset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  onConnectionChange: (next: ConnectionConfig) => void;
  rangeDays: RangeDays;
  onDataset: (mode: DataMode, dataset?: MonitoringDataset) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [showKey, setShowKey] = useState(false);

  const setField = <K extends keyof ConnectionConfig>(key: K, value: ConnectionConfig[K]) => {
    onConnectionChange({ ...connection, [key]: value });
  };

  const connectLive = async () => {
    setBusy(true);
    try {
      const dataset = await fetchMonitoringIngest({
        data: {
          url: connection.url.trim(),
          apiKey: connection.apiKey.trim(),
          indexPattern: connection.indexPattern.trim(),
          timezone: connection.timezone.trim() || "UTC",
          rangeDays,
          collection: connection.collection,
        },
      });
      if (dataset.cluster.versionWarning) {
        toast.message(dataset.cluster.versionWarning);
      } else {
        toast.success(`Connected to ${dataset.cluster.name} (${dataset.cluster.version})`);
      }
      onDataset("live", dataset);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const applyPaste = () => {
    try {
      const dataset = parsePastedMonitoring(paste, rangeDays);
      onDataset("pasted", dataset);
      toast.success(`Loaded ${dataset.daily.length} days from pasted response`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not parse JSON");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Data source</SheetTitle>
          <SheetDescription>
            Elasticsearch 8.14.0 and later. Live needs a publicly reachable cluster. Private RFC1918 clusters: run the 8.14 query in Dev Tools and paste the aggregation response.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <Tabs defaultValue="live">
            <TabsList className="w-full">
              <TabsTrigger value="live" className="flex-1">
                Live
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex-1">
                Paste JSON
              </TabsTrigger>
              <TabsTrigger value="demo" className="flex-1">
                Demo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="es-url">Elasticsearch URL</Label>
                <Input
                  id="es-url"
                  placeholder="https://es.example.com:9200"
                  value={connection.url}
                  onChange={(e) => setField("url", e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="es-key">API key</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="es-key"
                  type={showKey ? "text" : "password"}
                  placeholder="base64 encoded key"
                  value={connection.apiKey}
                  onChange={(e) => setField("apiKey", e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Needs <span className="font-mono">monitor</span> plus read on .monitoring-es-* and metrics-elasticsearch.stack_monitoring.*. Stored only in this browser.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="es-pattern">Monitoring index pattern</Label>
                <Input
                  id="es-pattern"
                  value={connection.indexPattern}
                  onChange={(e) => setField("indexPattern", e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setField("indexPattern", DEFAULT_MONITORING_PATTERN)}>
                    8.14 both
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setField("indexPattern", PATTERN_INTERNAL)}>
                    .monitoring-es-*
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setField("indexPattern", PATTERN_BEATS)}>
                    stack_monitoring.index-*
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="es-tz">Time zone</Label>
                  <Input
                    id="es-tz"
                    value={connection.timezone}
                    onChange={(e) => setField("timezone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="es-col">Collection</Label>
                  <select
                    id="es-col"
                    className="flex h-11 w-full rounded-md border border-input bg-secondary px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    value={connection.collection}
                    onChange={(e) => setField("collection", e.target.value as ConnectionConfig["collection"])}
                  >
                    <option value="auto">Auto (8.14.0+ unified)</option>
                    <option value="internal">Internal (type=index_stats)</option>
                    <option value="beats">Agent / Metricbeat</option>
                  </select>
                </div>
              </div>
              <Button type="button" className="w-full" disabled={busy || !connection.url || !connection.apiKey} onClick={connectLive}>
                {busy ? <LoaderCircle className="animate-spin" /> : null}
                Query monitoring indices
              </Button>
            </TabsContent>

            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="es-json">Aggregation response</Label>
                <Textarea
                  id="es-json"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder='{ "aggregations": { "indices": { "buckets": [...] } } }'
                />
              </div>
              <Button type="button" className="w-full" disabled={!paste.trim()} onClick={applyPaste}>
                Load pasted response
              </Button>
            </TabsContent>

            <TabsContent value="demo" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sample data models a 16-node 8.18.4 cluster (8.14.0+) with OpenShift logs, Kafka, Prometheus, APM, Windows/IIS, and Stack Monitoring indices.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  onDataset("demo");
                  toast.message("Using demo cluster obs-prod (ES 8.14.0+)");
                  onOpenChange(false);
                }}
              >
                Use demo cluster
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
