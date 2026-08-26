import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  METHOD_NOTE,
  INTERNAL_INDEX_STATS_QUERY,
  BEATS_INDEX_STATS_QUERY,
  ES_814_COMBINED_QUERY,
} from "@/lib/es-queries";

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute top-2 right-2 z-10"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre className="overflow-x-auto rounded-lg bg-secondary p-4 pr-24 font-mono text-xs leading-relaxed text-secondary-foreground">
        {value}
      </pre>
    </div>
  );
}

export function QueryPanel() {
  const combined = JSON.stringify(ES_814_COMBINED_QUERY, null, 2);
  const internal = JSON.stringify(INTERNAL_INDEX_STATS_QUERY, null, 2);
  const beats = JSON.stringify(BEATS_INDEX_STATS_QUERY, null, 2);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Stack Monitoring query · ES 8.14.0+</CardTitle>
        <p className="text-xs text-muted-foreground">{METHOD_NOTE}</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="combined">
          <TabsList className="flex-wrap">
            <TabsTrigger value="combined">8.14 unified</TabsTrigger>
            <TabsTrigger value="internal">Internal collection</TabsTrigger>
            <TabsTrigger value="beats">Agent / Metricbeat</TabsTrigger>
          </TabsList>
          <TabsContent value="combined">
            <p className="mb-2 text-xs text-muted-foreground">
              Run against{" "}
              <span className="font-mono text-foreground">
                .monitoring-es-*,metrics-elasticsearch.stack_monitoring.index-*
              </span>
              . Runtime fields unify timestamp/@timestamp and index_stats / elasticsearch.index paths.
            </p>
            <CopyBlock value={combined} />
          </TabsContent>
          <TabsContent value="internal">
            <p className="mb-2 text-xs text-muted-foreground">
              Run against <span className="font-mono text-foreground">.monitoring-es-*</span> (type=index_stats).
            </p>
            <CopyBlock value={internal} />
          </TabsContent>
          <TabsContent value="beats">
            <p className="mb-2 text-xs text-muted-foreground">
              Run against{" "}
              <span className="font-mono text-foreground">metrics-elasticsearch.stack_monitoring.index-*</span>
              .
            </p>
            <CopyBlock value={beats} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
