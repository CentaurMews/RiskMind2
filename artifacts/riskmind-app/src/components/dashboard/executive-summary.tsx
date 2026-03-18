import { useListRisks, useListOverdueReviews } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { AlertTriangle } from "lucide-react";

export function ExecutiveSummary() {
  const { data: risks, isLoading: risksLoading } = useListRisks({
    status: "open",
    limit: 5,
  });
  const { data: overdue } = useListOverdueReviews();

  const topRisks = [...(risks?.data || [])]
    .sort(
      (a, b) =>
        (b.likelihood ?? 0) * (b.impact ?? 0) -
        (a.likelihood ?? 0) * (a.impact ?? 0)
    )
    .slice(0, 5);

  const overdueCount = Array.isArray(overdue) ? overdue.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What Needs Attention</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Top risks and upcoming obligations.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive font-medium">
              {overdueCount} overdue review{overdueCount !== 1 ? "s" : ""} require attention
            </span>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Top Risks by Score
          </p>
          {risksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-5 w-[60px] rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          ) : topRisks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open risks.</p>
          ) : (
            <div className="space-y-2">
              {topRisks.map((risk) => {
                const score = (risk.likelihood ?? 0) * (risk.impact ?? 0);
                const severity =
                  score >= 17
                    ? "critical"
                    : score >= 10
                    ? "high"
                    : score >= 5
                    ? "medium"
                    : "low";
                return (
                  <div key={risk.id} className="flex items-center gap-2 text-sm">
                    <SeverityBadge severity={severity} />
                    <span className="flex-1 truncate font-medium">{risk.title}</span>
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
