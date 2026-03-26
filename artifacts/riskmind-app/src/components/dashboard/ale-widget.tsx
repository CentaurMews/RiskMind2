import { useGetForesightScenariosTopAle } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { TrendingUp } from "lucide-react";

function formatAle(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function AleWidget() {
  const { data, isLoading, isError } = useGetForesightScenariosTopAle();

  const items = data ?? [];
  const isEmpty = !isLoading && (isError || items.length === 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Top Risks by ALE</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-[140px]" />
                <Skeleton className="h-4 w-[60px]" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <p className="text-sm text-muted-foreground">No simulations yet.</p>
            <Link href="/foresight" className="text-sm text-primary hover:underline font-medium">
              Run First Simulation
            </Link>
          </div>
        ) : (
          <ol className="space-y-2">
            {items.slice(0, 5).map((item, index) => (
              <li key={item.scenarioId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground font-mono text-xs w-4 shrink-0">
                    {index + 1}.
                  </span>
                  <span className="truncate">{item.scenarioName}</span>
                </div>
                <span className="font-mono text-muted-foreground shrink-0 ml-2">
                  {formatAle(item.ale)}/yr
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
