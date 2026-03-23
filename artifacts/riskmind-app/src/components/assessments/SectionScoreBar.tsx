import { getScoreTier, type SectionScore } from "./types";

interface SectionScoreBarProps {
  sections: SectionScore[];
}

export function SectionScoreBar({ sections }: SectionScoreBarProps) {
  // Sort ascending by score (worst first)
  const sorted = [...sections].sort((a, b) => a.score - b.score);

  return (
    <div className="space-y-3 w-full">
      {sorted.map((section) => {
        const tier = getScoreTier(section.score);
        return (
          <div key={section.sectionId} className="flex items-center gap-3">
            {/* Section name */}
            <span
              className="text-sm text-muted-foreground shrink-0 truncate"
              style={{ minWidth: "120px", maxWidth: "160px" }}
              title={section.name}
            >
              {section.name}
            </span>

            {/* Bar */}
            <div className="bg-muted rounded-full h-3 flex-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-600 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, section.score))}%`,
                  backgroundColor: tier.color,
                  transition: "width 0.6s ease-out",
                }}
              />
            </div>

            {/* Score numeral */}
            <span className="text-sm font-medium w-14 text-right shrink-0">
              {section.score.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
