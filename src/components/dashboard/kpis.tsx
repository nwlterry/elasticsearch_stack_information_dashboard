import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatBytes, formatDocs, formatPct, dateLabel } from "@/lib/format";
import { periodStats } from "@/lib/ingest";
import type { DailyIngestPoint } from "@/lib/types";

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={up ? "text-warning" : "text-success"}>
      <span className="inline-flex items-center gap-1">
        <Icon className="size-3.5" />
        {formatPct(value)}
      </span>
    </span>
  );
}

export function KpiRow({
  daily,
  selectedDate,
}: {
  daily: DailyIngestPoint[];
  selectedDate: string | null;
}) {
  const stats = periodStats(daily);
  const selected = selectedDate ? daily.find((d) => d.date === selectedDate) : null;
  const todayLabel = selected ? dateLabel(selected.date) : "Latest day";
  const todayValue = selected ? selected.bytes : stats.today;
  const todayDocs = selected ? selected.docs : stats.todayDocs;

  const items = [
    {
      label: todayLabel,
      value: formatBytes(todayValue),
      hint: `${formatDocs(todayDocs)} docs`,
      extra: selected ? null : <Delta value={stats.vsYesterday} />,
    },
    {
      label: "7-day average",
      value: formatBytes(stats.avg7),
      hint: "calendar days",
      extra: null,
    },
    {
      label: "Period total",
      value: formatBytes(stats.periodTotal),
      hint: `${formatDocs(stats.periodDocs)} docs`,
      extra: null,
    },
    {
      label: "Peak day",
      value: formatBytes(stats.peak?.bytes ?? 0),
      hint: stats.peak ? dateLabel(stats.peak.date) : "—",
      extra: null,
    },
    {
      label: "Half-range trend",
      value: formatPct(stats.trendPct),
      hint: "recent vs earlier",
      extra: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {items.map((item, index) => (
        <Card
          key={item.label}
          className={index === items.length - 1 ? "col-span-2 px-4 py-4 lg:col-span-1" : "px-4 py-4"}
        >
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {item.label}
          </p>
          <p className="mt-2 font-mono text-2xl leading-none font-medium tracking-tight text-foreground tabular-nums">
            {item.value}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{item.hint}</span>
            {item.extra}
          </div>
        </Card>
      ))}
    </div>
  );
}
