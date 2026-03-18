import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import type { Kri } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

type KriWithTitle = Kri & { riskTitle?: string };

function KriBar({ kri }: { kri: KriWithTitle }) {
  const current = Number(kri.currentValue ?? 0);
  const warning = Number(kri.warningThreshold ?? Infinity);
  const critical = Number(kri.criticalThreshold ?? Infinity);
  const status = current >= critical ? "critical" : current >= warning ? "warning" : "ok";
  const max = Math.max(critical * 1.2, current * 1.2, 10);
  const pct = Math.min(100, (current / max) * 100);

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0 mt-0.5",
          status === "critical"
            ? "bg-red-500"
            : status === "warning"
            ? "bg-amber-500"
            : "bg-emerald-500"
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium truncate">{kri.name}</span>
          <span className="text-muted-foreground font-mono ml-2 shrink-0">
            {current}
            {kri.unit ? ` ${kri.unit}` : ""}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              status === "critical"
                ? "bg-red-500"
                : status === "warning"
                ? "bg-amber-500"
                : "bg-emerald-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function KriWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/v1/kris"],
    queryFn: () =>
      customFetch<{ data: KriWithTitle[] }>("/api/v1/kris?limit=8"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Key Risk Indicators</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Threshold monitoring across all risks.
          </p>
        </div>
        <Link
          href="/risks"
          className="text-sm text-primary hover:underline flex items-center font-medium"
        >
          View Risks <ArrowUpRight className="h-4 w-4 ml-1" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No KRIs configured yet.
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {data.data.map((kri) => (
              <KriBar key={kri.id} kri={kri} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
