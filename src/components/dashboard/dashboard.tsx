import { useMemo, useState } from "react";
import { Activity, Database, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildDemoDataset } from "@/lib/demo-data";
import { filterFamilies, periodStats } from "@/lib/ingest";
import { utcToday } from "@/lib/format";
import { DEFAULT_MONITORING_PATTERN } from "@/lib/es-queries";
import type {
  ConnectionConfig,
  DataMode,
  MonitoringDataset,
  RangeDays,
  StreamFamily,
} from "@/lib/types";
import { ConnectSheet } from "./connect-sheet";
import { FamilyShare } from "./family-share";
import { HourlyChart } from "./hourly-chart";
import { IndexTable } from "./index-table";
import { IngestCalendar } from "./ingest-calendar";
import { IngestChart } from "./ingest-chart";
import { KpiRow } from "./kpis";
import { QueryPanel } from "./query-panel";

const RANGES: RangeDays[] = [7, 14, 30, 90];

const DEFAULT_CONNECTION: ConnectionConfig = {
  url: "",
  apiKey: "",
  indexPattern: DEFAULT_MONITORING_PATTERN,
  timezone: "UTC",
  collection: "auto",
};

function modeBadge(mode: DataMode) {
  if (mode === "live") return { label: "Live cluster", variant: "success" as const };
  if (mode === "pasted") return { label: "Pasted response", variant: "warning" as const };
  return { label: "Demo", variant: "outline" as const };
}

export function Dashboard() {
  const demo = useMemo(() => buildDemoDataset(utcToday()), []);
  const [mode, setMode] = useState<DataMode>("demo");
  const [live, setLive] = useState<MonitoringDataset | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<StreamFamily>>(new Set());
  const [connectOpen, setConnectOpen] = useState(false);
  const [connection, setConnection] = useState<ConnectionConfig>(DEFAULT_CONNECTION);

  const source = mode === "demo" ? demo : (live ?? demo);
  const rangedDaily = useMemo(
    () => source.daily.slice(-rangeDays),
    [source.daily, rangeDays],
  );
  const visibleDaily = useMemo(() => filterFamilies(rangedDaily, hidden), [rangedDaily, hidden]);
  const stats = periodStats(visibleDaily);
  const visibleIndices = source.indices;

  const toggleFamily = (family: StreamFamily) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      if (next.size === 6) {
        toast.message("At least one family must stay visible");
        return prev;
      }
      return next;
    });
  };

  const badge = modeBadge(mode);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-family-logs">
                <Activity className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium tracking-tight text-foreground">Ingest Watch</p>
                <p className="truncate text-xs text-muted-foreground">
                  Daily ingest from Stack Monitoring · ES 8.14.0+
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setConnectOpen(true)}>
              <Radio className="size-3.5" />
              Connect
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <Badge variant="outline">ES 8.14.0+</Badge>
              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Database className="size-3.5 shrink-0" />
                <span className="truncate font-mono">{source.cluster.name}</span>
                <span className="hidden sm:inline">
                  · {source.cluster.version} · {source.cluster.nodes || "—"} nodes
                </span>
              </span>
            </div>
            <div className="flex w-full rounded-lg bg-secondary p-1 sm:w-auto">
              {RANGES.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    setRangeDays(days);
                    setSelectedDate(null);
                  }}
                  className={`h-8 flex-1 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 sm:flex-none ${
                    rangeDays === days
                      ? "bg-card text-foreground shadow-[var(--shadow-border)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        {source.cluster.versionWarning ? (
          <p className="rounded-lg bg-warning/15 px-4 py-3 text-sm text-warning">
            {source.cluster.versionWarning}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Source <span className="font-mono text-foreground">{source.cluster.monitoringIndex}</span>
            {" · "}
            {source.cluster.fieldMap}
            {selectedDate ? (
              <>
                {" · "}
                Isolated {selectedDate}
                <button
                  type="button"
                  className="ml-2 underline decoration-border underline-offset-4 hover:text-foreground"
                  onClick={() => setSelectedDate(null)}
                >
                  Clear
                </button>
              </>
            ) : null}
          </p>
          <p className="font-mono">as of {source.cluster.lastSeen.replace("T", " ").replace(".000Z", " UTC")}</p>
        </div>

        <KpiRow daily={visibleDaily} selectedDate={selectedDate} />

        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="hourly">Last 24h</TabsTrigger>
          </TabsList>
          <TabsContent value="daily" className="space-y-4">
            <IngestChart
              daily={visibleDaily}
              hidden={hidden}
              onToggleFamily={toggleFamily}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <FamilyShare totals={stats.familyTotals} hidden={hidden} />
              </div>
              <div className="lg:col-span-2">
                <IngestCalendar
                  daily={rangedDaily}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="hourly">
            <HourlyChart hourly={source.hourly} />
          </TabsContent>
        </Tabs>

        <IndexTable indices={visibleIndices} hidden={hidden} />
        <QueryPanel />
      </main>

      <ConnectSheet
        open={connectOpen}
        onOpenChange={setConnectOpen}
        connection={connection}
        onConnectionChange={setConnection}
        rangeDays={rangeDays}
        onDataset={(nextMode, dataset) => {
          setMode(nextMode);
          setSelectedDate(null);
          if (dataset) setLive(dataset);
          if (nextMode === "demo") setLive(null);
        }}
      />
    </div>
  );
}
