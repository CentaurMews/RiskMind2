import { cn } from "@/lib/utils";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { LineChart, Line } from "recharts";

interface DomainCardProps {
  category: string;                     // DB category value
  displayName: string;                  // mapped display name (Cyber, Ops, etc.)
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  highCriticalCount: number;            // count of high+critical risks
  sparklineData: Array<{ month: string; score: number }>; // last 6 months
  isActive?: boolean;                   // selected filter state
  onClick?: () => void;                 // clicking filters heatmap
  className?: string;
}

function getRiskLevelStyles(riskLevel: "Low" | "Medium" | "High" | "Critical"): {
  badge: string;
  dot: string;
  sparkColor: string;
} {
  switch (riskLevel) {
    case "Critical":
      return {
        badge: "bg-severity-critical/10 text-severity-critical",
        dot: "bg-severity-critical",
        sparkColor: "hsl(var(--severity-critical))",
      };
    case "High":
      return {
        badge: "bg-severity-high/10 text-severity-high",
        dot: "bg-severity-high",
        sparkColor: "hsl(var(--severity-high))",
      };
    case "Medium":
      return {
        badge: "bg-severity-medium/10 text-foreground",
        dot: "bg-severity-medium",
        sparkColor: "hsl(var(--severity-medium))",
      };
    case "Low":
    default:
      return {
        badge: "bg-severity-low/10 text-severity-low",
        dot: "bg-severity-low",
        sparkColor: "hsl(var(--severity-low))",
      };
  }
}

export function DomainCard({
  category,
  displayName,
  riskLevel,
  highCriticalCount,
  sparklineData,
  isActive,
  onClick,
  className,
}: DomainCardProps) {
  const styles = getRiskLevelStyles(riskLevel);

  const sparkConfig: ChartConfig = {
    score: { color: styles.sparkColor },
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${displayName} domain: ${riskLevel} risk level, ${highCriticalCount} high or critical risks`}
      aria-pressed={isActive}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-category={category}
      className={cn(
        "border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 min-w-0 overflow-hidden",
        isActive && "ring-2 ring-primary bg-primary/5",
        className
      )}
    >
      {/* Top row: display name + risk level dot */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", styles.dot)} />
        <span className="font-semibold text-xs text-foreground truncate">{displayName}</span>
        <span className={cn("text-[10px] font-medium flex-shrink-0 ml-auto", styles.badge.includes("critical") ? "text-severity-critical" : styles.badge.includes("high") ? "text-severity-high" : "text-muted-foreground")}>
          {riskLevel}
        </span>
      </div>

      {/* Middle: recharts sparkline */}
      <ChartContainer config={sparkConfig} className="h-6 w-full mt-1">
        <LineChart data={sparklineData}>
          <Line
            type="monotone"
            dataKey="score"
            dot={false}
            strokeWidth={1.5}
            stroke={styles.sparkColor}
          />
        </LineChart>
      </ChartContainer>

      {/* Bottom row: high/critical count */}
      <div className="mt-1 text-[10px] text-muted-foreground truncate">
        {highCriticalCount > 0 ? `${highCriticalCount} high/critical` : "—"}
      </div>
    </div>
  );
}
