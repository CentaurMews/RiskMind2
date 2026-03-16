import { AppLayout } from "@/components/layout/app-layout";
import { Binoculars } from "lucide-react";

export default function Foresight() {
  return (
    <AppLayout>
      <div className="p-8 h-full flex flex-col items-center justify-center text-center">
        <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6 shadow-inner border">
          <Binoculars className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Foresight & Simulation</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Predictive Monte Carlo simulations and graphical risk propagation analysis are currently in development for Phase 2.
        </p>
        <div className="px-4 py-2 bg-sidebar text-sidebar-foreground font-mono text-xs uppercase tracking-widest rounded shadow-sm">
          Coming Soon
        </div>
      </div>
    </AppLayout>
  );
}
