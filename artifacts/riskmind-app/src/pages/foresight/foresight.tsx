import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, GitCompare, Zap } from "lucide-react";
import { useListForesightScenarios } from "@workspace/api-client-react";
import type { CalibrationResult } from "@workspace/api-client-react";
import { ScenarioList } from "./scenario-list";
import { CalibrationPanel } from "./calibration-panel";
import { ScenarioCompare } from "./scenario-compare";

type ActiveTab = "scenarios" | "compare" | "calibration";

export default function Foresight() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("scenarios");

  const { data: scenarios = [] } = useListForesightScenarios();

  /** Called from CalibrationPanel when user clicks "Apply to New Scenario" */
  const handleApplyCalibration = (_result: CalibrationResult) => {
    // Switch to scenarios tab so the user can create a new scenario
    setActiveTab("scenarios");
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Foresight</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monte Carlo risk simulation and quantitative analysis
          </p>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ActiveTab)}
          className="w-full"
        >
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger
              value="scenarios"
              className="data-[state=active]:shadow-sm rounded-md gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Scenarios
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              className="data-[state=active]:shadow-sm rounded-md gap-2"
            >
              <GitCompare className="h-4 w-4" />
              Compare
            </TabsTrigger>
            <TabsTrigger
              value="calibration"
              className="data-[state=active]:shadow-sm rounded-md gap-2"
            >
              <Zap className="h-4 w-4" />
              Calibration
            </TabsTrigger>
          </TabsList>

          {/* Scenarios tab — self-contained ScenarioList with create/edit/run */}
          <TabsContent value="scenarios" className="mt-6">
            <ScenarioList />
          </TabsContent>

          {/* Compare tab */}
          <TabsContent value="compare" className="mt-6">
            <ScenarioCompare scenarios={scenarios} />
          </TabsContent>

          {/* Calibration tab */}
          <TabsContent value="calibration" className="mt-6">
            <CalibrationPanel
              onApplyToNewScenario={handleApplyCalibration}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
