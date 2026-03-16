import { AppLayout } from "@/components/layout/app-layout";
import { useGetRiskHeatmap } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function RiskHeatmap() {
  const { data, isLoading } = useGetRiskHeatmap();

  // Initialize empty 5x5 grid (likelihood: 1-5, impact: 1-5)
  // X axis = Impact, Y axis = Likelihood (top to bottom = 5 to 1)
  
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

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risk Heatmap</h1>
          <p className="text-muted-foreground mt-1">Visual distribution of enterprise risks by likelihood and impact.</p>
        </div>

        <div className="bg-card border rounded-2xl p-8 lg:p-16 shadow-sm overflow-hidden flex flex-col items-center justify-center min-h-[600px] relative">
          {isLoading ? (
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          ) : (
            <div className="relative w-full max-w-3xl">
              {/* Y Axis Label */}
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-sm font-bold tracking-widest text-muted-foreground whitespace-nowrap uppercase">
                Likelihood
              </div>
              
              {/* X Axis Label */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-sm font-bold tracking-widest text-muted-foreground uppercase">
                Impact
              </div>

              {/* Grid */}
              <div className="grid grid-cols-[auto_1fr] gap-4">
                {/* Y Axis Scale */}
                <div className="flex flex-col justify-between items-end pr-4 text-xs font-mono text-muted-foreground font-medium py-4">
                  <span>5 (Almost Certain)</span>
                  <span>4 (Likely)</span>
                  <span>3 (Possible)</span>
                  <span>2 (Unlikely)</span>
                  <span>1 (Rare)</span>
                </div>

                <div className="aspect-square grid grid-cols-5 grid-rows-5 gap-1.5 md:gap-2">
                  {[5, 4, 3, 2, 1].map(l => (
                    [1, 2, 3, 4, 5].map(i => {
                      const cell = getCellData(l, i);
                      const count = cell?.risks?.length || 0;
                      return (
                        <div 
                          key={`${l}-${i}`}
                          className={cn(
                            "rounded-lg border transition-all duration-300 flex items-center justify-center text-2xl cursor-pointer hover:scale-[1.02]",
                            getCellColor(count, l, i)
                          )}
                          title={`Likelihood: ${l}, Impact: ${i} - ${count} risks`}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      )
                    })
                  ))}
                </div>

                <div></div> {/* Empty corner */}
                
                {/* X Axis Scale */}
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
    </AppLayout>
  );
}
