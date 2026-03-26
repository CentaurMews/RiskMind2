import { useState } from "react";
import {
  useListForesightScenarios,
  useDeleteForesightScenario,
  useCloneForesightScenario,
  useCreateForesightSimulation,
  getListForesightScenariosQueryKey,
  type ForesightScenario,
  ForesightSimulationStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy,
  Loader2,
  Play,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ScenarioForm } from "./scenario-form";
import { LossExceedanceChart } from "@/components/foresight/loss-exceedance-chart";

function formatUSDCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function SimulationStatusBadge({ status }: { status: string }) {
  switch (status) {
    case ForesightSimulationStatus.completed:
      return <Badge className="bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/10">Completed</Badge>;
    case ForesightSimulationStatus.running:
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/10"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case ForesightSimulationStatus.pending:
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/10">Pending</Badge>;
    case ForesightSimulationStatus.failed:
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return null;
  }
}

function ScenarioCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

interface ScenarioCardProps {
  scenario: ForesightScenario;
  onRunSimulation: (scenario: ForesightScenario) => void;
  isRunning: boolean;
}

function ScenarioCard({ scenario, onRunSimulation, isRunning }: ScenarioCardProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const latestSim = scenario.latestSimulation;
  const simStatus = latestSim?.status;
  const isActivelyRunning = simStatus === ForesightSimulationStatus.running || simStatus === ForesightSimulationStatus.pending;
  const hasResults = simStatus === ForesightSimulationStatus.completed && latestSim?.results;

  const deleteMutation = useDeleteForesightScenario({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListForesightScenariosQueryKey() });
        toast({ title: "Scenario deleted" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete scenario", variant: "destructive" });
      },
    },
  });

  const cloneMutation = useCloneForesightScenario({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListForesightScenariosQueryKey() });
        toast({ title: "Scenario cloned" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to clone scenario", variant: "destructive" });
      },
    },
  });

  return (
    <>
      <Card className="transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold truncate">{scenario.name}</h3>
                {simStatus && <SimulationStatusBadge status={simStatus} />}
              </div>
              {scenario.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {scenario.description}
                </p>
              )}
              {hasResults && latestSim?.results && (
                <p className="text-xs text-muted-foreground mt-1">
                  ALE:{" "}
                  <span className="font-semibold text-foreground">
                    {formatUSDCompact(latestSim.results.ale)}
                  </span>
                  /year
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Run simulation */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRunSimulation(scenario)}
                disabled={isRunning || isActivelyRunning}
                className="h-7 text-xs gap-1"
              >
                {isRunning || isActivelyRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Run
              </Button>

              {/* Clone */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => cloneMutation.mutate({ id: scenario.id })}
                disabled={cloneMutation.isPending}
                title="Clone scenario"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                title="Delete scenario"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              {/* Expand chart */}
              {hasResults && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setExpanded((v) => !v)}
                  title={expanded ? "Collapse chart" : "Expand chart"}
                >
                  {expanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Inline loss exceedance chart */}
        {expanded && hasResults && latestSim?.results && (
          <CardContent className="pt-0 border-t">
            <div className="mt-4">
              <LossExceedanceChart
                histogram={latestSim.results.histogram}
                percentiles={latestSim.results.percentiles}
                iterations={latestSim.results.iterations}
                ale={latestSim.results.ale}
                title={scenario.name}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{scenario.name}" and all its simulation history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                deleteMutation.mutate({ id: scenario.id });
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Scenario</SheetTitle>
            <SheetDescription>Update the scenario parameters.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ScenarioForm
              scenario={scenario}
              onSuccess={() => setEditOpen(false)}
              onCancel={() => setEditOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ScenarioList() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  // Check if any simulation is pending/running to enable polling
  const { data: scenarios, isLoading } = useListForesightScenarios({
    query: {
      refetchInterval: (query) => {
        const data = query.state.data as ForesightScenario[] | undefined;
        if (!data) return false;
        const hasActive = data.some(
          (s) =>
            s.latestSimulation?.status === ForesightSimulationStatus.pending ||
            s.latestSimulation?.status === ForesightSimulationStatus.running
        );
        return hasActive ? 2000 : false; // poll every 2s when active simulations exist
      },
    },
  });

  const createSimulationMutation = useCreateForesightSimulation({
    mutation: {
      onSuccess: (sim) => {
        qc.invalidateQueries({ queryKey: getListForesightScenariosQueryKey() });
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(sim.scenarioId);
          return next;
        });
        toast({ title: "Simulation queued", description: "Results will appear when complete." });
      },
      onError: (_err, { data }) => {
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(data.scenarioId);
          return next;
        });
        toast({ title: "Error", description: "Failed to start simulation", variant: "destructive" });
      },
    },
  });

  const handleRunSimulation = (scenario: ForesightScenario) => {
    const params = scenario.parameters as {
      iterationCount?: number;
    };
    const iterationCount = params.iterationCount ?? 50000;

    setRunningIds((prev) => new Set(prev).add(scenario.id));
    createSimulationMutation.mutate({
      data: {
        scenarioId: scenario.id,
        iterationCount,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {scenarios?.length ?? 0} scenario{(scenarios?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Scenario
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <ScenarioCardSkeleton />
          <ScenarioCardSkeleton />
          <ScenarioCardSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!scenarios || scenarios.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl">
          <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No scenarios yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
            Create your first scenario to run a Monte Carlo simulation.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Scenario
          </Button>
        </div>
      )}

      {/* Scenario cards */}
      {!isLoading && scenarios && scenarios.length > 0 && (
        <div className="space-y-3">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onRunSimulation={handleRunSimulation}
              isRunning={runningIds.has(scenario.id)}
            />
          ))}
        </div>
      )}

      {/* Create scenario dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Scenario</DialogTitle>
          </DialogHeader>
          <ScenarioForm
            onSuccess={() => setCreateOpen(false)}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
