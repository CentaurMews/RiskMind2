import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetRiskHeatmap } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RiskHeatmapChart } from "@/components/dashboard/risk-heatmap-chart";

export default function RiskHeatmap() {
  const { data, isLoading } = useGetRiskHeatmap();
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = params.get("l");
    const i = params.get("i");
    if (l && i) setSelectedCell({ likelihood: Number(l), impact: Number(i) });
  }, []);

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

        <div className="bg-card border rounded-2xl p-8 shadow-sm overflow-hidden flex flex-col items-center justify-center min-h-[600px] relative">
          {isLoading ? (
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          ) : (
            <>
              {/* Mobile fallback: severity summary list */}
              <div className="md:hidden space-y-2 w-full">
                {(() => {
                  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
                  (data?.cells || []).forEach((cell: any) => {
                    const score = cell.likelihood * cell.impact;
                    const count = cell.risks?.length || 0;
                    if (score >= 15) counts.critical += count;
                    else if (score >= 10) counts.high += count;
                    else if (score >= 5) counts.medium += count;
                    else counts.low += count;
                  });
                  return [
                    { label: "Critical", count: counts.critical, className: "text-severity-critical bg-severity-critical/10 border-severity-critical/30" },
                    { label: "High", count: counts.high, className: "text-severity-high bg-severity-high/10 border-severity-high/30" },
                    { label: "Medium", count: counts.medium, className: "text-foreground bg-severity-medium/10 border-severity-medium/30" },
                    { label: "Low", count: counts.low, className: "text-muted-foreground bg-severity-low/10 border-severity-low/30" },
                  ].map(({ label, count, className }) => (
                    <div key={label} className={cn("flex items-center justify-between px-3 py-2 rounded-md border font-mono text-sm", className)}>
                      <span className="font-medium">{label}</span>
                      <span className="font-bold">{count} risk{count !== 1 ? "s" : ""}</span>
                    </div>
                  ));
                })()}
              </div>

              {/* ECharts heatmap: hidden on mobile, visible on md+ */}
              <div className="hidden md:block w-full" style={{ minHeight: 500 }}>
                <RiskHeatmapChart
                  cells={(data?.cells || []) as Array<{ likelihood: number; impact: number; risks: Array<{ id: string; title: string; status: string; category: string }> }>}
                  onCellClick={(l, i) => setSelectedCell({ likelihood: l, impact: i })}
                  selectedCell={selectedCell}
                />
              </div>
            </>
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
