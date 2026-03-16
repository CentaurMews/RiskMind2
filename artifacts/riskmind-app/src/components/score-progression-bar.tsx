import { ArrowRight } from "lucide-react";

interface ScoreProgressionBarProps {
  inherentScore: number;
  residualScore: number | null;
  targetScore: number | null;
}

function getScoreColor(score: number): string {
  if (score >= 15) return "bg-red-500";
  if (score >= 10) return "bg-orange-500";
  if (score >= 5) return "bg-amber-400";
  return "bg-emerald-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 15) return "text-red-600";
  if (score >= 10) return "text-orange-600";
  if (score >= 5) return "text-amber-600";
  return "text-emerald-600";
}

function getScoreLabel(score: number): string {
  if (score >= 15) return "Critical";
  if (score >= 10) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

function ScoreSegment({ label, score }: { label: string; score: number | null }) {
  const displayScore = score ?? 0;
  const width = score !== null ? Math.max(8, (displayScore / 25) * 100) : 8;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      {score !== null ? (
        <>
          <div className="w-full rounded-full h-3 bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreColor(displayScore)}`}
              style={{ width: `${width}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-lg font-bold ${getScoreTextColor(displayScore)}`}>{displayScore}</span>
            <span className={`text-xs font-medium ${getScoreTextColor(displayScore)}`}>{getScoreLabel(displayScore)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="w-full rounded-full h-3 bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-muted-foreground/20" style={{ width: "8%" }} />
          </div>
          <span className="text-xs text-muted-foreground italic">Not set</span>
        </>
      )}
    </div>
  );
}

export function ScoreProgressionBar({ inherentScore, residualScore, targetScore }: ScoreProgressionBarProps) {
  return (
    <div className="flex items-center gap-2">
      <ScoreSegment label="Inherent" score={inherentScore} />
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
      <ScoreSegment label="Residual" score={residualScore} />
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
      <ScoreSegment label="Target" score={targetScore} />
    </div>
  );
}
