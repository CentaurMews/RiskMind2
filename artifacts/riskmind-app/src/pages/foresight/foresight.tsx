import { AppLayout } from "@/components/layout/app-layout";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScenarioList } from "./scenario-list";

export default function Foresight() {
  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Foresight</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monte Carlo risk simulation and quantitative analysis
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="scenarios">
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger value="scenarios" className="rounded-md">
              Scenarios
            </TabsTrigger>
            <TabsTrigger value="simulations" className="rounded-md">
              Simulations
            </TabsTrigger>
            <TabsTrigger value="calibration" className="rounded-md">
              Calibration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="mt-6">
            <ScenarioList />
          </TabsContent>

          <TabsContent value="simulations" className="mt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl">
              <p className="text-sm font-medium text-muted-foreground">
                Select a scenario to view simulations
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                Run a simulation from a scenario card to see detailed results here.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="calibration" className="mt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl">
              <p className="text-sm font-medium text-muted-foreground">
                Calibration — coming in Plan 03
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                Auto-calibrate FAIR parameters from your real signal and threat intelligence data.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
