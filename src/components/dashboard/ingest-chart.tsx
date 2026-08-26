import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STREAM_FAMILIES, type DailyIngestPoint, type StreamFamily } from "@/lib/types";
import { FAMILY_COLOR, FAMILY_LABEL } from "@/lib/family";
import { dateLabel, formatBytes } from "@/lib/format";

interface ChartRow {
  date: string;
  label: string;
  logs: number;
  metrics: number;
  kafka: number;
  apm: number;
  system: number;
  other: number;
  bytes: number;
  anomaly: boolean;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, item) => sum + (item.value || 0), 0);
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-xs shadow-[var(--shadow-border)]">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      {payload
        .filter((item) => item.value > 0)
        .map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ background: item.color }} />
              {item.name}
            </span>
            <span className="font-mono tabular-nums text-foreground">{formatBytes(item.value)}</span>
          </div>
        ))}
      <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-medium">
        <span>Total</span>
        <span className="font-mono tabular-nums">{formatBytes(total)}</span>
      </div>
    </div>
  );
}

export function IngestChart({
  daily,
  hidden,
  onToggleFamily,
  selectedDate,
  onSelectDate,
}: {
  daily: DailyIngestPoint[];
  hidden: ReadonlySet<StreamFamily>;
  onToggleFamily: (family: StreamFamily) => void;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const data: ChartRow[] = daily.map((d) => ({
    date: d.date,
    label: dateLabel(d.date),
    logs: d.byFamily.logs,
    metrics: d.byFamily.metrics,
    kafka: d.byFamily.kafka,
    apm: d.byFamily.apm,
    system: d.byFamily.system,
    other: d.byFamily.other,
    bytes: d.bytes,
    anomaly: d.anomaly,
  }));

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-foreground">Daily ingest</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Primary store growth from Stack Monitoring index_stats. Click a day to isolate it.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STREAM_FAMILIES.map((family) => {
            const off = hidden.has(family);
            return (
              <button
                key={family}
                type="button"
                onClick={() => onToggleFamily(family)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-opacity duration-150 ${
                  off ? "opacity-40" : "opacity-100"
                } bg-secondary text-secondary-foreground`}
              >
                <span className="size-1.5 rounded-full" style={{ background: FAMILY_COLOR[family] }} />
                {FAMILY_LABEL[family]}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onClick={(state) => {
                const date = (state?.activePayload?.[0]?.payload as ChartRow | undefined)?.date;
                if (!date) return;
                onSelectDate(selectedDate === date ? null : date);
              }}
            >
              <defs>
                {STREAM_FAMILIES.map((family) => (
                  <linearGradient key={family} id={`fill-${family}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FAMILY_COLOR[family]} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={FAMILY_COLOR[family]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v: number) => formatBytes(v, 0)}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--color-ring)", strokeWidth: 1 }} />
              {STREAM_FAMILIES.map((family) =>
                hidden.has(family) ? null : (
                  <Area
                    key={family}
                    type="monotone"
                    dataKey={family}
                    name={FAMILY_LABEL[family]}
                    stackId="ingest"
                    stroke={FAMILY_COLOR[family]}
                    fill={`url(#fill-${family})`}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                ),
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
