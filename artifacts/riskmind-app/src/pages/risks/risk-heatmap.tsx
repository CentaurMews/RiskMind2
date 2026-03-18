import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetRiskHeatmap } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HeatmapGrid } from "@/components/dashboard/heatmap-grid";

export default function RiskHeatmap() {
  const { data, isLoading } = useGetRiskHeatmap();
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = params.get("l");
    const i = params.get("i");
    if (l && i) setSelectedCell({ likelihood: Number(l), impact: Number(i) });
  }, []);

  const getCellColor = (count: number, likelihood: number, impact: number) => {
    if (count === 0) return "bg-card hover:bg-muted/50 border-border/50";
    const score = likelihood * impact;
    if (score >= 15) return "bg-severity-critical/20 hover:bg-severity-critical/30 border-severity-critical/50 text-severity-critical font-bold shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]";
    if (score >= 10) return "bg-severity-high/20 hover:bg-severity-high/30 border-severity-high/50 text-severity-high font-bold";
    if (score >= 5) return "bg-severity-medium/20 hover:bg-severity-medium/30 border-severity-medium/50 text-yellow-600 dark:text-yellow-500 font-bold";
    return "bg-severity-low/20 hover:bg-severity-low/30 border-severity-low/50 text-severity-low font-bold";
  };

  const getCellData = (l: number, i: number) => {
    return data?.cells?.find(c => c.likelihood === l && c.impact === i);
  };

  const selectedCellData = selectedCell ? getCellData(selectedCell.likelihood, selectedCell.impact) : null;
  const selectedRisks = selectedCellData?.risks || [];

  const computeSeverity = (l: number, i: number) => {
    const score = l * i;
    if (score >= 15) return "critical";
    if (score >= 10) return "high";
    if (score >= 5) return "medium";
    return "low";
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risk Heatmap</h1>
          <p className="text-muted-foreground mt-1">Visual distribution of enterprise risks by likelihood and impact. Click a cell to drill down.</p>
        </div>

        <div className="bg-card border rounded-2xl p-8 lg:p-16 shadow-sm overflow-hidden flex flex-col items-center justify-center min-h-[600px] relative">
          {isLoading ? (
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          ) : (
            <div className="relative w-full max-w-3xl">
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-sm font-bold tracking-widest text-muted-foreground whitespace-nowrap uppercase">
                Likelihood
              </div>
              
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-sm font-bold tracking-widest text-muted-foreground uppercase">
                Impact
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-4">
                <div className="flex flex-col justify-between items-end pr-4 text-xs font-mono text-muted-foreground font-medium py-4">
                  <span>5 (Almost Certain)</span>
                  <span>4 (Likely)</span>
                  <span>3 (Possible)</span>
                  <span>2 (Unlikely)</span>
                  <span>1 (Rare)</span>
                </div>

                <div className="aspect-square">
                  <HeatmapGrid
                    cells={(data?.cells || []) as Array<{ likelihood: number; impact: number; risks: Array<{ id: string; title: string; status: string; category: string }> }>}
                    compact={false}
                    onCellClick={(l, i) => setSelectedCell({ likelihood: l, impact: i })}
                  />
                </div>

                <div />
                
                <div className="flex justify-between items-start pt-4 text-xs font-mono text-muted-foreground font-medium px-4">
                  <span className="w-0 text-center relative -left-4">1 (Negligible)</span>
                  <span className="w-0 text-center relative -left-4">2 (Minor)</span>
                  <span className="w-0 text-center relative -left-4">3 (Moderate)</span>
                  <span className="w-0 text-center relative -left-4">4 (Major)</span>
                  <span className="w-0 text-center relative -left-8">5 (Catastrophic)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selectedCell} onOpenChange={(open) => { if (!open) setSelectedCell(null); }}>
        <SheetContent className="sm:max-w-lg w-full border-l overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SeverityBadge severity={selectedCell ? computeSeverity(selectedCell.likelihood, selectedCell.impact) : "low"} />
              L{selectedCell?.likelihood} x I{selectedCell?.impact} &mdash; {selectedRisks.length} Risk{selectedRisks.length !== 1 ? "s" : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {selectedRisks.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No risks in this cell.</div>
            ) : (
              selectedRisks.map((risk) => (
                <Link key={risk.id} href={`/risks/${risk.id}`}>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm group-hover:text-primary transition-colors">{risk.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">L:{risk.likelihood} I:{risk.impact}</span>
                      <span>&middot;</span>
                      <span className="capitalize">{risk.category}</span>
                      <span>&middot;</span>
                      <span className="capitalize">{risk.status}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
