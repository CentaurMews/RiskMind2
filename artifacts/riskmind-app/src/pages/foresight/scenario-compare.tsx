import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-react";
import { ComparisonChart } from "@/components/foresight/loss-exceedance-chart";
import type { ForesightScenario, HistogramBin } from "@workspace/api-client-react";

interface ScenarioCompareProps {
  scenarios: ForesightScenario[];
}

interface DiffRow {
  label: string;
  aValue: string;
  bValue: string;
  deltaValue?: string;
  isDelta?: boolean;
}

const SCENARIO_COLORS = {
  a: "#3b82f6", // blue-500
  b: "#f97316", // orange-500
};

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatVulnerability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTef(value: number): string {
  if (value < 1) {
    return `${value.toFixed(2)} evt/yr`;
  }
  return `${value.toFixed(1)} evt/yr`;
}

function deltaPercent(a: number, b: number): string {
  if (a === 0) return "—";
  const pct = ((b - a) / Math.abs(a)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function buildDiffRows(
  scenarioA: ForesightScenario,
  scenarioB: ForesightScenario
): DiffRow[] {
  const paramsA = scenarioA.parameters as Record<string, unknown>;
  const paramsB = scenarioB.parameters as Record<string, unknown>;

  const getTriangular = (
    params: Record<string, unknown>,
    key: string
  ): { min: number; mode: number; max: number } | null => {
    const val = params[key];
    if (
      val &&
      typeof val === "object" &&
      "min" in val &&
      "mode" in val &&
      "max" in val
    ) {
      return val as { min: number; mode: number; max: number };
    }
    return null;
  };

  const tefA = getTriangular(paramsA, "tef");
  const tefB = getTriangular(paramsB, "tef");
  const vulnA = getTriangular(paramsA, "vulnerability");
  const vulnB = getTriangular(paramsB, "vulnerability");
  const lmA = getTriangular(paramsA, "lossMagnitude");
  const lmB = getTriangular(paramsB, "lossMagnitude");
  const iterA = typeof paramsA["iterations"] === "number" ? (paramsA["iterations"] as number) : null;
  const iterB = typeof paramsB["iterations"] === "number" ? (paramsB["iterations"] as number) : null;

  const rows: DiffRow[] = [];

  if (tefA && tefB) {
    rows.push({
      label: "TEF — Min",
      aValue: formatTef(tefA.min),
      bValue: formatTef(tefB.min),
      deltaValue: deltaPercent(tefA.min, tefB.min),
    });
    rows.push({
      label: "TEF — Mode",
      aValue: formatTef(tefA.mode),
      bValue: formatTef(tefB.mode),
      deltaValue: deltaPercent(tefA.mode, tefB.mode),
    });
    rows.push({
      label: "TEF — Max",
      aValue: formatTef(tefA.max),
      bValue: formatTef(tefB.max),
      deltaValue: deltaPercent(tefA.max, tefB.max),
    });
  }

  if (vulnA && vulnB) {
    rows.push({
      label: "Vulnerability — Min",
      aValue: formatVulnerability(vulnA.min),
      bValue: formatVulnerability(vulnB.min),
      deltaValue: deltaPercent(vulnA.min, vulnB.min),
    });
    rows.push({
      label: "Vulnerability — Mode",
      aValue: formatVulnerability(vulnA.mode),
      bValue: formatVulnerability(vulnB.mode),
      deltaValue: deltaPercent(vulnA.mode, vulnB.mode),
    });
    rows.push({
      label: "Vulnerability — Max",
      aValue: formatVulnerability(vulnA.max),
      bValue: formatVulnerability(vulnB.max),
      deltaValue: deltaPercent(vulnA.max, vulnB.max),
    });
  }

  if (lmA && lmB) {
    rows.push({
      label: "Loss Magnitude — Min",
      aValue: formatUsd(lmA.min),
      bValue: formatUsd(lmB.min),
      deltaValue: deltaPercent(lmA.min, lmB.min),
    });
    rows.push({
      label: "Loss Magnitude — Mode",
      aValue: formatUsd(lmA.mode),
      bValue: formatUsd(lmB.mode),
      deltaValue: deltaPercent(lmA.mode, lmB.mode),
    });
    rows.push({
      label: "Loss Magnitude — Max",
      aValue: formatUsd(lmA.max),
      bValue: formatUsd(lmB.max),
      deltaValue: deltaPercent(lmA.max, lmB.max),
    });
  }

  if (iterA !== null && iterB !== null) {
    rows.push({
      label: "Iterations",
      aValue: iterA.toLocaleString(),
      bValue: iterB.toLocaleString(),
    });
  }

  return rows;
}

export function ScenarioCompare({ scenarios }: ScenarioCompareProps) {
  const completedScenarios = scenarios.filter(
    (s) => s.latestSimulation?.status === "completed"
  );

  const [scenarioAId, setScenarioAId] = useState<string>("");
  const [scenarioBId, setScenarioBId] = useState<string>("");

  const scenarioA = completedScenarios.find((s) => s.id === scenarioAId);
  const scenarioB = completedScenarios.find((s) => s.id === scenarioBId);

  const canCompare =
    scenarioA !== undefined &&
    scenarioB !== undefined &&
    scenarioAId !== scenarioBId;

  // Build chart data from two scenarios
  const chartScenarios = canCompare
    ? [
        {
          name: scenarioA.name,
          histogram: (scenarioA.latestSimulation?.results?.histogram ??
            []) as HistogramBin[],
          percentiles: (scenarioA.latestSimulation?.results?.percentiles ??
            {}) as Record<string, number>,
          color: SCENARIO_COLORS.a,
        },
        {
          name: scenarioB.name,
          histogram: (scenarioB.latestSimulation?.results?.histogram ??
            []) as HistogramBin[],
          percentiles: (scenarioB.latestSimulation?.results?.percentiles ??
            {}) as Record<string, number>,
          color: SCENARIO_COLORS.b,
        },
      ]
    : [];

  // ALE comparison
  const aleA = scenarioA?.latestSimulation?.results?.ale;
  const aleB = scenarioB?.latestSimulation?.results?.ale;

  // Diff table rows
  const diffRows =
    canCompare ? buildDiffRows(scenarioA, scenarioB) : [];

  if (completedScenarios.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <GitCompare className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            Need at least 2 completed simulations to compare scenarios
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Run simulations on your scenarios to enable comparison
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Compare Scenarios</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select two scenarios with completed simulations to overlay their loss
          exceedance curves and compare FAIR parameters.
        </p>
      </div>

      {/* Scenario pickers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Scenario A
          </label>
          <Select value={scenarioAId} onValueChange={setScenarioAId}>
            <SelectTrigger
              className="border-blue-300 dark:border-blue-700 focus:ring-blue-500"
              style={{ borderLeftColor: SCENARIO_COLORS.a, borderLeftWidth: 3 }}
            >
              <SelectValue placeholder="Select scenario A…" />
            </SelectTrigger>
            <SelectContent>
              {completedScenarios.map((s) => (
                <SelectItem key={s.id} value={s.id} disabled={s.id === scenarioBId}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Scenario B
          </label>
          <Select value={scenarioBId} onValueChange={setScenarioBId}>
            <SelectTrigger
              style={{
                borderLeftColor: SCENARIO_COLORS.b,
                borderLeftWidth: 3,
              }}
            >
              <SelectValue placeholder="Select scenario B…" />
            </SelectTrigger>
            <SelectContent>
              {completedScenarios.map((s) => (
                <SelectItem key={s.id} value={s.id} disabled={s.id === scenarioAId}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparison content */}
      {canCompare && (
        <div className="space-y-6">
          {/* ALE comparison */}
          {aleA !== undefined && aleB !== undefined && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/10">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SCENARIO_COLORS.a }}
                    />
                    <p className="text-xs text-muted-foreground truncate">
                      {scenarioA.name}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{formatUsd(aleA)}</p>
                  <p className="text-xs text-muted-foreground">ALE</p>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Delta</p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      aleB > aleA
                        ? "text-destructive"
                        : aleB < aleA
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {deltaPercent(aleA, aleB)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {aleB > aleA ? "higher risk" : aleB < aleA ? "lower risk" : "equal"}
                  </p>
                </CardContent>
              </Card>

              <Card
                style={{
                  borderColor: `${SCENARIO_COLORS.b}40`,
                  backgroundColor: `${SCENARIO_COLORS.b}08`,
                }}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SCENARIO_COLORS.b }}
                    />
                    <p className="text-xs text-muted-foreground truncate">
                      {scenarioB.name}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{formatUsd(aleB)}</p>
                  <p className="text-xs text-muted-foreground">ALE</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Overlaid loss exceedance chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Loss Exceedance Curves
              </CardTitle>
              <CardDescription className="text-xs">
                Probability that annual loss exceeds a given value
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComparisonChart scenarios={chartScenarios} />
            </CardContent>
          </Card>

          {/* Parameter diff table */}
          {diffRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Parameter Comparison
                </CardTitle>
                <CardDescription className="text-xs">
                  FAIR input parameters side by side
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-1/3">
                          Parameter
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium w-1/4">
                          <div className="flex items-center justify-center gap-1.5">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: SCENARIO_COLORS.a }}
                            />
                            <span className="truncate max-w-24">{scenarioA.name}</span>
                          </div>
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium w-1/4">
                          <div className="flex items-center justify-center gap-1.5">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: SCENARIO_COLORS.b }}
                            />
                            <span className="truncate max-w-24">{scenarioB.name}</span>
                          </div>
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-1/6">
                          Delta
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffRows.map((row, i) => (
                        <tr
                          key={row.label}
                          className={`border-b last:border-0 ${
                            i % 2 === 0 ? "bg-background" : "bg-muted/20"
                          }`}
                        >
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {row.label}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-center tabular-nums font-medium">
                            {row.aValue}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-center tabular-nums font-medium">
                            {row.bValue}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-center tabular-nums">
                            {row.deltaValue ? (
                              <Badge
                                variant="outline"
                                className={`text-xs px-1.5 py-0 ${
                                  row.deltaValue.startsWith("+")
                                    ? "text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                                    : row.deltaValue.startsWith("-")
                                    ? "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {row.deltaValue}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Prompt to select both scenarios */}
      {!canCompare && completedScenarios.length >= 2 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <GitCompare className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select two different scenarios above to compare them
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
