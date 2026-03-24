import { cn } from "@/lib/utils";

interface RiskPostureBarProps {
  score: number;              // 0-100 composite risk index
  appetiteThreshold: number;  // 0-100 global appetite
  onClick?: () => void;       // opens explanation panel
  className?: string;
}

export function RiskPostureBar({ score, appetiteThreshold, onClick, className }: RiskPostureBarProps) {
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const clampedThreshold = Math.min(Math.max(appetiteThreshold, 0), 100);
  const isAboveAppetite = clampedScore > clampedThreshold;

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
      aria-label={`Risk posture: ${score} out of 100. Appetite threshold: ${appetiteThreshold}.`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-6 rounded-full bg-muted overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      {/* Appetite band: green region from 0 to threshold */}
      <div
        className="absolute inset-y-0 left-0 bg-emerald-500/15"
        style={{ width: `${clampedThreshold}%` }}
      />

      {/* Score fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{
          width: `${clampedScore}%`,
          backgroundColor: isAboveAppetite
            ? "hsl(var(--severity-critical))"
            : "hsl(var(--severity-low))",
        }}
      />

      {/* Appetite line marker */}
      <div
        className="absolute inset-y-0 w-0.5 bg-foreground/40"
        style={{ left: `${clampedThreshold}%` }}
      />

      {/* Score label */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-xs font-bold text-foreground/80 pointer-events-none select-none"
        style={{ left: `${clampedScore}%` }}
      >
        {score}
      </div>
    </div>
  );
}
