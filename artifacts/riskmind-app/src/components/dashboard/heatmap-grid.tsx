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
  return (
    <div className={cn("grid grid-cols-5 grid-rows-5", compact ? "gap-1" : "gap-1.5 md:gap-2")}>
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
  );
}
