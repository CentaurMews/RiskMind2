import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetRiskHeatmap } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Loader2, LayoutGrid, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

const CATEGORY_COLORS: Record<string, { dot: string; border: string; label: string }> = {
  operational:    { dot: "bg-orange-500",  border: "border-orange-400",  label: "Operational" },
  financial:      { dot: "bg-emerald-500", border: "border-emerald-400", label: "Financial" },
  compliance:     { dot: "bg-violet-500",  border: "border-violet-400",  label: "Compliance" },
  strategic:      { dot: "bg-blue-500",    border: "border-blue-400",    label: "Strategic" },
  technology:     { dot: "bg-cyan-500",    border: "border-cyan-400",    label: "Technology" },
  reputational:   { dot: "bg-rose-500",    border: "border-rose-400",    label: "Reputational" },
};

const ZONE_BG: Record<string, string> = {
  critical: "bg-red-50/60 dark:bg-red-950/20",
  high:     "bg-orange-50/60 dark:bg-orange-950/20",
  medium:   "bg-yellow-50/60 dark:bg-yellow-950/20",
  low:      "bg-green-50/40 dark:bg-green-950/10",
};

const ZONE_BORDER: Record<string, string> = {
  critical: "border-red-200/60 dark:border-red-800/40",
  high:     "border-orange-200/60 dark:border-orange-800/40",
  medium:   "border-yellow-200/60 dark:border-yellow-800/40",
  low:      "border-green-200/60 dark:border-green-800/40",
};

const ZONE_LABEL: Record<string, string> = {
  critical: "text-red-400/60",
  high:     "text-orange-400/60",
  medium:   "text-yellow-500/60",
  low:      "text-green-500/40",
};

function getZone(l: number, i: number): string {
  const score = l * i;
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5)  return "medium";
  return "low";
}

type HeatmapRisk = {
  id: string;
  title: string;
  likelihood: number;
  impact: number;
  category: string;
  status: string;
};

function RiskDot({ risk, cellSize }: { risk: HeatmapRisk; cellSize: number }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const dotRef = useRef<HTMLButtonElement>(null);
  const [, navigate] = useLocation();
  const colors = CATEGORY_COLORS[risk.category] || { dot: "bg-gray-500", border: "border-gray-400", label: risk.category };
  const score = risk.likelihood * risk.impact;
  const dotSize = cellSize < 72 ? 10 : 13;

  return (
      <button
        ref={dotRef}
        type="button"
        className={cn(
          "relative block rounded-full border-2 border-white/80 shadow-md cursor-pointer transition-all duration-150 hover:scale-150 hover:z-50 hover:shadow-lg shrink-0",
          colors.dot,
        )}
        style={{ width: dotSize, height: dotSize }}
        onMouseEnter={() => {
          const rect = dotRef.current?.getBoundingClientRect();
          const parentRect = dotRef.current?.closest(".heatmap-grid")?.getBoundingClientRect();
          if (rect && parentRect) {
            setTooltip({ x: rect.left - parentRect.left + dotSize / 2, y: rect.top - parentRect.top });
          }
        }}
        onMouseLeave={() => setTooltip(null)}
        onClick={() => navigate(`/risks/${risk.id}`)}
        title={risk.title}
      >
        {tooltip && (
          <div
            className="fixed z-[200] pointer-events-none"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y - 8}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="bg-popover border border-border rounded-xl shadow-xl px-3 py-2.5 min-w-[200px] max-w-[260px]">
              <p className="text-xs font-semibold leading-snug text-popover-foreground mb-1.5 line-clamp-2">{risk.title}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium border capitalize", colors.dot.replace("bg-", "text-").replace("-500", "-600"), colors.dot.replace("-500", "-100"))}>
                  {colors.label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">L{risk.likelihood}×I{risk.impact}={score}</span>
                <span className={cn("text-[10px] capitalize px-1.5 py-0.5 rounded-full",
                  risk.status === "open" ? "bg-blue-50 text-blue-600" :
                  risk.status === "mitigated" ? "bg-emerald-50 text-emerald-600" :
                  risk.status === "accepted" ? "bg-amber-50 text-amber-600" :
                  "bg-muted text-muted-foreground"
                )}>{risk.status}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1.5">Click to open →</p>
            </div>
          </div>
        )}
      </button>
  );
}

function HeatCell({
  l, i, risks, cellSize,
}: {
  l: number; i: number; risks: HeatmapRisk[]; cellSize: number;
}) {
  const zone = getZone(l, i);
  const hasRisks = risks.length > 0;

  const arrangedDots = (() => {
    if (risks.length <= 1) return risks;
    return [...risks].sort((a, b) => {
      const za = getZone(a.likelihood, a.impact);
      const zb = getZone(b.likelihood, b.impact);
      const order = ["critical", "high", "medium", "low"];
      return order.indexOf(za) - order.indexOf(zb);
    });
  })();

  return (
    <div
      className={cn(
        "relative rounded-lg border transition-all duration-200 flex flex-wrap items-center justify-center content-center gap-1 p-1.5 overflow-hidden",
        hasRisks ? ZONE_BG[zone] : "bg-card",
        hasRisks ? ZONE_BORDER[zone] : "border-border/40",
      )}
      style={{ width: cellSize, height: cellSize, minWidth: cellSize, minHeight: cellSize }}
    >
      {!hasRisks && (
        <span className={cn("text-[9px] font-mono opacity-30", ZONE_LABEL[zone])}>
          {l}×{i}
        </span>
      )}
      {arrangedDots.map((r) => (
        <RiskDot key={r.id} risk={r} cellSize={cellSize} />
      ))}
      {hasRisks && risks.length > 9 && (
        <div className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-muted-foreground/60 bg-background/60 px-0.5 rounded">
          {risks.length}
        </div>
      )}
    </div>
  );
}

const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost\nCertain"];
const IMPACT_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

export default function RiskHeatmap() {
  const { data, isLoading } = useGetRiskHeatmap();
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(80);

  useEffect(() => {
    const update = () => {
      if (gridRef.current) {
        const available = gridRef.current.clientWidth - 80;
        setCellSize(Math.max(56, Math.min(100, Math.floor(available / 5))));
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (gridRef.current) observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  const getCellRisks = (l: number, i: number): HeatmapRisk[] => {
    const cell = data?.cells?.find(c => c.likelihood === l && c.impact === i);
    return (cell?.risks || []) as HeatmapRisk[];
  };

  const allRisks: HeatmapRisk[] = (data?.cells || []).flatMap(c => (c.risks || []) as HeatmapRisk[]);
  const totalCount = allRisks.length;

  const categoryCounts = allRisks.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});

  const criticalCount = allRisks.filter(r => r.likelihood * r.impact >= 15).length;
  const highCount = allRisks.filter(r => { const s = r.likelihood * r.impact; return s >= 10 && s < 15; }).length;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              Risk Heatmap
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Each dot is an individual risk — hover for detail, click to open. Colours indicate category.
            </p>
          </div>
          {!isLoading && totalCount > 0 && (
            <div className="flex items-center gap-3 text-sm shrink-0">
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />{criticalCount} Critical
                </span>
              )}
              {highCount > 0 && (
                <span className="flex items-center gap-1 text-orange-600 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />{highCount} High
                </span>
              )}
              <span className="text-muted-foreground">{totalCount} total</span>
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin h-7 w-7 text-primary" />
            </div>
          ) : (
            <div ref={gridRef} className="heatmap-grid relative w-full">
              <div className="grid grid-cols-[56px_1fr] gap-2">
                <div className="flex flex-col items-end justify-around pr-2" style={{ height: cellSize * 5 + 8 * 4 }}>
                  {[5, 4, 3, 2, 1].map(l => (
                    <div key={l} className="text-right" style={{ height: cellSize }}>
                      <div className="flex flex-col items-end justify-center h-full">
                        <span className="text-[11px] font-bold text-muted-foreground leading-none">{l}</span>
                        <span className="text-[9px] text-muted-foreground/60 leading-tight whitespace-nowrap">{LIKELIHOOD_LABELS[l - 1]}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  {[5, 4, 3, 2, 1].map(l => (
                    <div key={l} className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(i => (
                        <HeatCell
                          key={`${l}-${i}`}
                          l={l}
                          i={i}
                          risks={getCellRisks(l, i)}
                          cellSize={cellSize}
                        />
                      ))}
                    </div>
                  ))}

                  <div className="flex gap-2 mt-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex flex-col items-center" style={{ width: cellSize }}>
                        <span className="text-[11px] font-bold text-muted-foreground leading-none">{i}</span>
                        <span className="text-[9px] text-muted-foreground/60 leading-tight text-center">{IMPACT_LABELS[i - 1]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full -rotate-90 origin-center text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase whitespace-nowrap select-none pointer-events-none">
                Likelihood →
              </div>
            </div>
          )}
        </div>

        {!isLoading && totalCount > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
              {Object.entries(CATEGORY_COLORS).map(([cat, { dot, label }]) => {
                const count = categoryCounts[cat] || 0;
                if (count === 0) return null;
                return (
                  <div key={cat} className="flex items-center gap-1.5">
                    <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-mono font-medium text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 flex-wrap">
              {(["critical", "high", "medium", "low"] as const).map(zone => {
                const info = {
                  critical: { label: "Critical (≥15)", bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
                  high:     { label: "High (10–14)",  bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
                  medium:   { label: "Medium (5–9)",  bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
                  low:      { label: "Low (1–4)",     bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
                }[zone];
                return (
                  <div key={zone} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs", info.bg, info.text, info.border)}>
                    <span className={cn("h-2 w-2 rounded-sm", zone === "critical" ? "bg-red-400" : zone === "high" ? "bg-orange-400" : zone === "medium" ? "bg-yellow-400" : "bg-green-400")} />
                    {info.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
