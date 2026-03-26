/**
 * Loss Exceedance Chart — ECharts-based area chart for Monte Carlo simulation results.
 *
 * NOTE: This file is a scaffold created by Plan 14-03 to unblock parallel builds.
 * Plan 14-02 replaces the full implementation. The ComparisonChart export below
 * is the integration contract that ScenarioCompare depends on.
 *
 * Plan 14-02 provides:
 *   - LossExceedanceChart (single scenario)
 *   - ComparisonChart (two overlaid scenarios)
 */

import type { HistogramBin } from "@workspace/api-client-react";

export interface SingleScenarioChartProps {
  histogram: HistogramBin[];
  percentiles: Record<string, number>;
  /** Accent color for the area fill (defaults to primary) */
  color?: string;
}

export interface ComparisonScenario {
  name: string;
  histogram: HistogramBin[];
  percentiles: Record<string, number>;
  color: string;
}

export interface ComparisonChartProps {
  scenarios: ComparisonScenario[];
}

/**
 * Renders a single loss exceedance curve.
 * Full implementation provided by Plan 14-02.
 */
export function LossExceedanceChart({
  histogram: _histogram,
  percentiles: _percentiles,
  color: _color,
}: SingleScenarioChartProps) {
  return (
    <div className="flex items-center justify-center h-64 rounded-lg bg-muted/30 text-muted-foreground text-sm">
      Loss exceedance chart — full implementation in Plan 14-02
    </div>
  );
}

/**
 * Renders two overlaid loss exceedance curves for scenario comparison.
 * Full implementation provided by Plan 14-02.
 */
export function ComparisonChart({ scenarios }: ComparisonChartProps) {
  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg bg-muted/30 text-muted-foreground text-sm">
        Select two scenarios to compare
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-64 rounded-lg bg-muted/30 text-muted-foreground text-sm">
      Overlaid loss exceedance curves — full implementation in Plan 14-02
    </div>
  );
}
