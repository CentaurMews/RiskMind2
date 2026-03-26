import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, BarChart3, GitCompare, Zap } from "lucide-react";
import { useListForesightScenarios } from "@workspace/api-client-react";
import type { ForesightScenario, CalibrationResult } from "@workspace/api-client-react";
import { ScenarioList } from "./scenario-list";
import { ScenarioForm } from "./scenario-form";
import { CalibrationPanel } from "./calibration-panel";
import { ScenarioCompare } from "./scenario-compare";

type ActiveTab = "scenarios" | "compare" | "calibration";

export default function Foresight() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("scenarios");
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [editingScenario, setEditingScenario] = useState<
    ForesightScenario | undefined
  >(undefined);

  // Pre-filled calibration values to pass to scenario form
  const [pendingCalibration, setPendingCalibration] =
    useState<CalibrationResult | null>(null);

  const { data: scenarios = [] } = useListForesightScenarios();

  const handleCreateNew = () => {
    setEditingScenario(undefined);
    setPendingCalibration(null);
    setShowScenarioForm(true);
  };

  const handleEdit = (scenario: ForesightScenario) => {
    setEditingScenario(scenario);
    setPendingCalibration(null);
    setShowScenarioForm(true);
  };

  const handleFormClose = () => {
    setShowScenarioForm(false);
    setEditingScenario(undefined);
    setPendingCalibration(null);
  };

  /** Called from CalibrationPanel when user clicks "Apply to New Scenario" */
  const handleApplyCalibration = (result: CalibrationResult) => {
    setPendingCalibration(result);
    setEditingScenario(undefined);
    setShowScenarioForm(true);
    setActiveTab("scenarios");
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Foresight</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monte Carlo risk simulation and quantitative analysis
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Scenario
          </Button>
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

          {/* Scenarios tab */}
          <TabsContent value="scenarios" className="mt-6">
            <ScenarioList onCreateNew={handleCreateNew} onEdit={handleEdit} />
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

      {/* Scenario create/edit slide-over */}
      <Sheet open={showScenarioForm} onOpenChange={setShowScenarioForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>
              {editingScenario ? "Edit Scenario" : "New Scenario"}
            </SheetTitle>
          </SheetHeader>
          <ScenarioForm
            scenario={editingScenario}
            calibrationResult={pendingCalibration}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
