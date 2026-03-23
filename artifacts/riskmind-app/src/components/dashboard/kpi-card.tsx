import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { LineChart, Line } from "recharts";
import { Link } from "wouter";

function generateSparklineData(current: number) {
  const start = Math.max(0, current + (Math.random() * 10 - 5));
  return Array.from({ length: 12 }, (_, i) => ({
    day: i,
    score: Math.round(start + ((current - start) * i / 11) + (Math.random() * 4 - 2)),
  }));
}

const sparkConfig: ChartConfig = { score: { color: "hsl(var(--primary))" } };

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  delta?: number;
  deltaLabel?: string;
  isLoading?: boolean;
  iconClassName?: string;
  showSparkline?: boolean;
  href?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  delta,
  deltaLabel = "from last week",
  isLoading,
  iconClassName,
  showSparkline,
  href,
}: KpiCardProps) {
  const sparkData =
    showSparkline && typeof value === "number" ? generateSparklineData(value) : null;

  const card = (
    <Card className={cn(
      "transition-all",
      href
        ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
        : "hover:shadow-md"
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", iconClassName)} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-[60px] mb-2" />
            <Skeleton className="h-3 w-[120px]" />
          </>
        ) : (
          <>
            <div className="flex items-end gap-3">
              <div className="text-3xl font-bold">{value}</div>
              {sparkData && (
                <ChartContainer config={sparkConfig} className="h-8 w-20 mb-1">
                  <LineChart data={sparkData}>
                    <Line
                      type="monotone"
                      dataKey="score"
                      dot={false}
                      strokeWidth={1.5}
                      stroke="hsl(var(--primary))"
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </div>
            {delta !== undefined ? (
              <p
                className={cn(
                  "text-xs mt-1 font-mono",
                  delta >= 0 ? "text-emerald-600" : "text-destructive"
                )}
              >
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} {deltaLabel}
              </p>
            ) : subtitle ? (
              <p className="text-xs text-muted-foreground mt-1 font-mono">{subtitle}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href} className="block">{card}</Link> : card;
}
