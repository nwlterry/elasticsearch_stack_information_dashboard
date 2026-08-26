import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dateLabel, formatBytes, weekdayLabel } from "@/lib/format";
import type { DailyIngestPoint } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayIndex(isoDate: string): number {
  const utc = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  return (utc + 6) % 7;
}

export function IngestCalendar({
  daily,
  selectedDate,
  onSelectDate,
}: {
  daily: DailyIngestPoint[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const max = Math.max(...daily.map((d) => d.bytes), 1);
  const startPad = daily.length ? mondayIndex(daily[0].date) : 0;
  const cells: Array<DailyIngestPoint | null> = [
    ...Array.from({ length: startPad }, () => null),
    ...daily,
  ];

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-foreground">Ingest calendar</CardTitle>
        <p className="text-xs text-muted-foreground">UTC days. Intensity is relative to the peak in range.</p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <div className="flex flex-col justify-between py-0.5 text-xs text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <span key={d} className="flex h-3.5 items-center leading-none">
                {d[0]}
              </span>
            ))}
          </div>
          <div className="grid auto-cols-max grid-flow-col grid-rows-7 gap-1 overflow-x-auto">
            {cells.map((cell, i) => {
              if (!cell) {
                return <span key={`pad-${i}`} className="size-3.5 rounded-xs" />;
              }
              const pct = Math.round((cell.bytes / max) * 100);
              const selected = selectedDate === cell.date;
              return (
                <Tooltip key={cell.date}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${cell.date} ${formatBytes(cell.bytes)}`}
                      onClick={() => onSelectDate(selected ? null : cell.date)}
                      className={`size-3.5 rounded-xs ${selected ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : ""}`}
                      style={{
                        background: `color-mix(in oklab, var(--color-family-logs) ${Math.max(pct, 8)}%, var(--color-muted))`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {weekdayLabel(cell.date)} {dateLabel(cell.date)} · {formatBytes(cell.bytes)}
                    {cell.anomaly ? " · anomaly" : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
