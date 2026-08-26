import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/format";
import type { HourlyIngestPoint } from "@/lib/types";

export function HourlyChart({ hourly }: { hourly: HourlyIngestPoint[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-foreground">Last 24 hours</CardTitle>
        <p className="text-xs text-muted-foreground">
          Diurnal shape of the latest calendar day. Live clusters show even buckets when hourly samples are not present.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(v: number) => formatBytes(v, 0)}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                formatter={(value) => formatBytes(Number(value))}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                cursor={{ fill: "var(--color-muted)" }}
              />
              <Bar dataKey="bytes" name="Ingest" fill="var(--color-family-logs)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
