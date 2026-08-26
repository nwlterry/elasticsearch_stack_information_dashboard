import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STREAM_FAMILIES, type FamilyBytes, type StreamFamily } from "@/lib/types";
import { FAMILY_COLOR, FAMILY_LABEL } from "@/lib/family";
import { formatBytes } from "@/lib/format";

export function FamilyShare({
  totals,
  hidden,
}: {
  totals: FamilyBytes;
  hidden: ReadonlySet<StreamFamily>;
}) {
  const rows = STREAM_FAMILIES.filter((f) => !hidden.has(f) && totals[f] > 0).map((family) => ({
    family,
    name: FAMILY_LABEL[family],
    value: totals[family],
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-foreground">Share by family</CardTitle>
        <p className="text-xs text-muted-foreground">Primary ingest over the selected range</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="var(--color-card)"
                  isAnimationActive={false}
                >
                  {rows.map((row) => (
                    <Cell key={row.family} fill={FAMILY_COLOR[row.family]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatBytes(Number(value))}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 flex-1 space-y-2">
            {rows.map((row) => (
              <li key={row.family} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: FAMILY_COLOR[row.family] }} />
                  {row.name}
                </span>
                <span className="font-mono text-foreground tabular-nums">
                  {formatBytes(row.value)}
                  <span className="ml-2 text-muted-foreground">
                    {total > 0 ? `${((row.value / total) * 100).toFixed(0)}%` : "0%"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
