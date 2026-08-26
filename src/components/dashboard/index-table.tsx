import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FAMILY_COLOR, FAMILY_LABEL } from "@/lib/family";
import { formatBytes, formatDocs } from "@/lib/format";
import type { IndexIngestRow, StreamFamily } from "@/lib/types";

type SortKey = "name" | "bytesPeriod" | "bytesToday" | "docsPeriod" | "currentStoreBytes";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-muted-foreground">—</span>;
  const max = Math.max(...values, 1);
  const w = 64;
  const h = 20;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - (v / max) * (h - 4);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-16 text-family-logs" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export function IndexTable({
  indices,
  hidden,
}: {
  indices: IndexIngestRow[];
  hidden: ReadonlySet<StreamFamily>;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("bytesPeriod");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = indices.filter((row) => {
      if (hidden.has(row.family)) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q) || row.family.includes(q);
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return dir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return sorted;
  }, [indices, hidden, query, sortKey, dir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "name" ? "asc" : "desc");
    }
  };

  const Head = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => {
    const active = sortKey === k;
    const Icon = dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"} ${className ?? ""}`}
      >
        {label}
        {active ? <Icon className="size-3" /> : null}
      </button>
    );
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-foreground">Indices & data streams</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ranked by primary ingest in the selected range. Size is day-over-day store delta.
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter indices"
          className="h-11 w-full sm:max-w-xs"
        />
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-y border-border">
                <th className="px-5 py-2 font-medium">
                  <Head k="name" label="Name" />
                </th>
                <th className="px-3 py-2 font-medium">Family</th>
                <th className="px-3 py-2 text-right font-medium">
                  <Head k="bytesToday" label="Latest" className="ml-auto" />
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  <Head k="bytesPeriod" label="Period" className="ml-auto" />
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  <Head k="docsPeriod" label="Docs" className="ml-auto" />
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  <Head k="currentStoreBytes" label="Store" className="ml-auto" />
                </th>
                <th className="px-5 py-2 font-medium text-muted-foreground">14d</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-border/70 last:border-0">
                  <td className="max-w-56 truncate px-5 py-2.5 font-mono text-xs text-foreground">
                    {row.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full" style={{ background: FAMILY_COLOR[row.family] }} />
                      {FAMILY_LABEL[row.family]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                    {formatBytes(row.bytesToday)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                    {formatBytes(row.bytesPeriod)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                    {formatDocs(row.docsPeriod)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-xs tabular-nums">{formatBytes(row.currentStoreBytes)}</span>
                      <Badge variant="outline" className="capitalize">
                        {row.ilmPhase} · {row.pri}p
                      </Badge>
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <Sparkline values={row.sparkline} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No indices match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
