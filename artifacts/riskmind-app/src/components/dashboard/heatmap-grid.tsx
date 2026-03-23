import { cn } from "@/lib/utils";

interface HeatmapGridProps {
  cells: Array<{
    likelihood: number;
    impact: number;
    risks: Array<{ id: string; title: string; status: string; category: string }>;
  }>;
  onCellClick?: (likelihood: number, impact: number) => void;
  compact?: boolean;
}

export function HeatmapGrid({ cells, onCellClick, compact = false }: HeatmapGridProps) {
  // Compute severity summary from cells data
  const severitySummary = (() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    cells.forEach(cell => {
      const score = cell.likelihood * cell.impact;
      const count = cell.risks?.length || 0;
      if (score >= 15) counts.critical += count;
      else if (score >= 10) counts.high += count;
      else if (score >= 5) counts.medium += count;
      else counts.low += count;
    });
    return counts;
  })();

  return (
    <>
      {/* Mobile fallback: severity list — hidden on md+ screens */}
      <div className="md:hidden space-y-2">
        {[
          { label: "Critical", count: severitySummary.critical, className: "text-severity-critical bg-severity-critical/10 border-severity-critical/30" },
          { label: "High", count: severitySummary.high, className: "text-severity-high bg-severity-high/10 border-severity-high/30" },
          { label: "Medium", count: severitySummary.medium, className: "text-foreground bg-severity-medium/10 border-severity-medium/30" },
          { label: "Low", count: severitySummary.low, className: "text-muted-foreground bg-severity-low/10 border-severity-low/30" },
        ].map(({ label, count, className }) => (
          <div key={label} className={cn("flex items-center justify-between px-3 py-2 rounded-md border font-mono text-sm", className)}>
            <span className="font-medium">{label}</span>
            <span className="font-bold">{count} risk{count !== 1 ? "s" : ""}</span>
          </div>
        ))}
      </div>

      {/* Full grid: hidden on mobile, visible on md+ */}
      <div className={cn("hidden md:grid grid-cols-5 grid-rows-5", compact ? "gap-1" : "gap-1.5 md:gap-2")}>
        {[5, 4, 3, 2, 1].flatMap(l =>
          [1, 2, 3, 4, 5].map(i => {
            const cell = cells.find(c => c.likelihood === l && c.impact === i);
            const count = cell?.risks?.length || 0;
            const score = l * i;

            const colorClass =
              count === 0
                ? "bg-muted/30 border-border/50"
                : score >= 15
                ? "bg-severity-critical/20 border-severity-critical/30 text-severity-critical font-bold"
                : score >= 10
                ? "bg-severity-high/20 border-severity-high/30 text-severity-high font-bold"
                : score >= 5
                ? "bg-severity-medium/20 border-severity-medium/30 font-bold"
                : "bg-severity-low/20 border-severity-low/30";

            const clickableClass =
              onCellClick
                ? "cursor-pointer hover:ring-2 hover:ring-primary/50"
                : "";

            return (
              <div
                key={`${l}-${i}`}
                className={cn(
                  "border flex items-center justify-center font-mono",
                  compact ? "rounded-sm text-[10px]" : "rounded-md text-sm",
                  colorClass,
                  clickableClass
                )}
                style={compact ? { aspectRatio: "1" } : undefined}
                title={`Likelihood: ${l}, Impact: ${i} — ${count} risk${count !== 1 ? "s" : ""}`}
                onClick={() => onCellClick?.(l, i)}
              >
                {count > 0 ? count : ""}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
