import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Play,
  Copy,
  Trash2,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  useListForesightScenarios,
  useCreateForesightSimulation,
  useCloneForesightScenario,
  useDeleteForesightScenario,
} from "@workspace/api-client-react";
import type { ForesightScenario } from "@workspace/api-client-react";
import { LossExceedanceChart } from "@/components/foresight/loss-exceedance-chart";

interface ScenarioListProps {
  onCreateNew?: () => void;
  onEdit?: (scenario: ForesightScenario) => void;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function SimulationStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
        >
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-destructive border-destructive/40"
        >
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function ScenarioCard({
  scenario,
  onEdit,
}: {
  scenario: ForesightScenario;
  onEdit?: (s: ForesightScenario) => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const { mutate: runSimulation, isPending: isRunning } =
    useCreateForesightSimulation({
      mutation: {
        onSuccess: () => {
          toast.success("Simulation started");
        },
        onError: () => {
          toast.error("Failed to start simulation");
        },
      },
    });

  const { mutate: cloneScenario, isPending: isCloning } =
    useCloneForesightScenario({
      mutation: {
        onSuccess: () => {
          toast.success("Scenario cloned");
        },
        onError: () => {
          toast.error("Failed to clone scenario");
        },
      },
    });

  const { mutate: deleteScenario, isPending: isDeleting } =
    useDeleteForesightScenario({
      mutation: {
        onSuccess: () => {
          toast.success("Scenario deleted");
        },
        onError: () => {
          toast.error("Failed to delete scenario");
        },
      },
    });

  const simulation = scenario.latestSimulation;
  const isSimRunning =
    simulation?.status === "running" || simulation?.status === "pending";
  const isCompleted = simulation?.status === "completed";
  const ale = simulation?.results?.ale;

  return (
    <>
      <Card className="hover:shadow-sm transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{scenario.name}</CardTitle>
              {scenario.description && (
                <CardDescription className="mt-0.5 line-clamp-2 text-xs">
                  {scenario.description}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {scenario.calibratedFrom && (
                <Badge
                  variant="outline"
                  className="text-xs gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Calibrated
                </Badge>
              )}
              {simulation && <SimulationStatusBadge status={simulation.status} />}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ALE + chart toggle */}
          {isCompleted && ale !== undefined && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Annual Loss Expectancy
                </p>
                <p className="text-xl font-bold tabular-nums">{formatUsd(ale)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChart((v) => !v)}
              >
                <BarChart3 className="h-4 w-4 mr-1.5" />
                {showChart ? "Hide chart" : "View chart"}
              </Button>
            </div>
          )}

          {/* Loss exceedance chart (togglable) */}
          {showChart && isCompleted && simulation?.results && (
            <div className="pt-1">
              <LossExceedanceChart
                histogram={simulation.results.histogram ?? []}
                percentiles={simulation.results.percentiles ?? {}}
              />
            </div>
          )}

          {/* Running indicator */}
          {isSimRunning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              Simulation in progress…
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                runSimulation({
                  data: {
                    scenarioId: scenario.id,
                    iterationCount: 50000,
                  },
                })
              }
              disabled={isRunning || isSimRunning}
            >
              {isRunning ? (
                <Spinner className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isCompleted ? "Re-run" : "Run Simulation"}
            </Button>

            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(scenario)}
              >
                Edit
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => cloneScenario({ id: scenario.id })}
              disabled={isCloning}
            >
              {isCloning ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{scenario.name}" and all associated
              simulation results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteScenario({ id: scenario.id });
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ScenarioList({ onCreateNew, onEdit }: ScenarioListProps) {
  const { data: scenarios, isLoading, isError } = useListForesightScenarios();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center gap-2 py-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">Failed to load scenarios</p>
        </CardContent>
      </Card>
    );
  }

  if (!scenarios || scenarios.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            No scenarios yet
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
            Create your first Monte Carlo scenario to get started
          </p>
          {onCreateNew && (
            <Button size="sm" onClick={onCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              New Scenario
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.id} scenario={scenario} onEdit={onEdit} />
      ))}
    </div>
  );
}
