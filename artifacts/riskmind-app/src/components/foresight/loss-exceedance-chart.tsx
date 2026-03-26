import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { HistogramBin, SimulationResultsPercentiles } from "@workspace/api-client-react";

// ── Theme helpers ──────────────────────────────────────────────────────────────

function hslStringToColor(hslValue: string): string {
  const trimmed = hslValue.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 3) {
    return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return `hsl(${trimmed})`;
}

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const getCssVar = (name: string) => style.getPropertyValue(name).trim();
  return {
    primary: hslStringToColor(getCssVar("--primary")),
    mutedForeground: hslStringToColor(getCssVar("--muted-foreground")),
    foreground: hslStringToColor(getCssVar("--foreground")),
    muted: hslStringToColor(getCssVar("--muted")),
    border: hslStringToColor(getCssVar("--border")),
    background: hslStringToColor(getCssVar("--background")),
    severityHigh: hslStringToColor(getCssVar("--severity-high")),
    severityCritical: hslStringToColor(getCssVar("--severity-critical")),
  };
}

function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

// ── Exceedance curve computation ───────────────────────────────────────────────

/**
 * Converts a histogram to a loss exceedance curve.
 * X = loss amount, Y = P(loss > X) = 1 - CDF
 */
function buildExceedanceCurve(
  histogram: HistogramBin[],
  total: number
): Array<[number, number]> {
  if (!histogram.length || total === 0) return [];

  // Sort bins by min value ascending
  const sorted = [...histogram].sort((a, b) => a.min - b.min);

  // Compute cumulative count (CDF numerator)
  const points: Array<[number, number]> = [];
  let cumulative = 0;

  // Add the origin point: P(loss > 0) = 1.0
  points.push([0, 1.0]);

  for (const bin of sorted) {
    // At the start of this bin: P(loss > bin.min) = 1 - cumulative/total
    const exceedanceAtStart = Math.max(0, 1 - cumulative / total);
    points.push([bin.min, exceedanceAtStart]);

    cumulative += bin.count;

    // At the end of this bin: P(loss > bin.max) = 1 - cumulative/total
    const exceedanceAtEnd = Math.max(0, 1 - cumulative / total);
    points.push([bin.max, exceedanceAtEnd]);
  }

  // Final point: P(loss > max) ≈ 0
  if (sorted.length > 0) {
    points.push([sorted[sorted.length - 1].max, 0]);
  }

  return points;
}

// ── Single chart ───────────────────────────────────────────────────────────────

export interface LossExceedanceChartProps {
  histogram: HistogramBin[];
  percentiles: SimulationResultsPercentiles;
  iterations: number;
  ale: number;
  title?: string;
  color?: string;
}

export function LossExceedanceChart({
  histogram,
  percentiles,
  iterations,
  ale,
  title,
  color,
}: LossExceedanceChartProps) {
  const [themeVersion, setThemeVersion] = useState(0);

  // MutationObserver for dark mode reactivity (same pattern as risk-heatmap-chart.tsx)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          setThemeVersion((v) => v + 1);
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const { colors, option } = useMemo(() => {
    void themeVersion;
    const c = getThemeColors();
    const seriesColor = color ?? c.primary;

    const total = histogram.reduce((sum, b) => sum + b.count, 0);
    const curve = buildExceedanceCurve(histogram, total);

    // Percentile markLines: P50, P90, P99
    const markLineData: Array<{
      name: string;
      xAxis: number;
      lineStyle: { type: string; color: string };
      label: { formatter: string; color: string; fontSize: number };
    }> = [];

    const pcts: Array<{ key: keyof SimulationResultsPercentiles; label: string }> = [
      { key: "p50", label: "P50" },
      { key: "p90", label: "P90" },
      { key: "p99", label: "P99" },
    ];

    for (const { key, label } of pcts) {
      const val = percentiles[key];
      if (val != null) {
        markLineData.push({
          name: label,
          xAxis: val,
          lineStyle: { type: "dashed", color: c.mutedForeground },
          label: {
            formatter: `{name|${label}}\n{val|${formatUSD(val)}}`,
            color: c.mutedForeground,
            fontSize: 10,
          },
        });
      }
    }

    const opt: EChartsOption = {
      backgroundColor: "transparent",
      animation: true,
      grid: {
        top: 32,
        right: 16,
        bottom: 56,
        left: 56,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const arr = params as Array<{ value: [number, number] }>;
          if (!arr.length) return "";
          const [x, y] = arr[0].value;
          const pct = (y * 100).toFixed(1);
          return `${formatUSD(x)}<br/><b>${pct}%</b> chance of exceeding`;
        },
        backgroundColor: c.background,
        borderColor: c.border,
        textStyle: { color: c.foreground, fontSize: 12 },
      },
      xAxis: {
        type: "value",
        name: "Annual Loss ($)",
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: { color: c.mutedForeground, fontSize: 11 },
        axisLine: { lineStyle: { color: c.border } },
        splitLine: { lineStyle: { color: c.muted, type: "dashed" } },
        axisLabel: {
          color: c.mutedForeground,
          fontSize: 10,
          formatter: (v: number) => formatUSD(v),
        },
      },
      yAxis: {
        type: "value",
        name: "P(Exceedance)",
        nameLocation: "middle",
        nameGap: 44,
        nameTextStyle: { color: c.mutedForeground, fontSize: 11 },
        min: 0,
        max: 1,
        axisLine: { lineStyle: { color: c.border } },
        splitLine: { lineStyle: { color: c.muted, type: "dashed" } },
        axisLabel: {
          color: c.mutedForeground,
          fontSize: 10,
          formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
        },
      },
      series: [
        {
          type: "line",
          name: title ?? "Loss Exceedance",
          data: curve,
          smooth: true,
          symbol: "none",
          lineStyle: { color: seriesColor, width: 2 },
          areaStyle: { color: seriesColor, opacity: 0.2 },
          markLine: {
            silent: false,
            symbol: ["none", "none"],
            data: markLineData,
            label: {
              rich: {
                name: { fontSize: 10, fontWeight: 600 },
                val: { fontSize: 9 },
              },
            },
          },
        },
      ],
    };

    return { colors: c, option: opt };
  }, [themeVersion, histogram, percentiles, ale, title, color]);

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ width: "100%", height: 400 }}
        notMerge={true}
        lazyUpdate={false}
      />

      {/* Summary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
        {[
          { label: "ALE (Mean)", value: formatUSD(ale) },
          { label: "P50 (Median)", value: percentiles.p50 != null ? formatUSD(percentiles.p50) : "—" },
          { label: "P90", value: percentiles.p90 != null ? formatUSD(percentiles.p90) : "—" },
          { label: "P99", value: percentiles.p99 != null ? formatUSD(percentiles.p99) : "—" },
          { label: "Iterations", value: iterations.toLocaleString() },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center p-2 bg-muted/40 rounded-lg"
          >
            <span className="text-[10px] text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold mt-0.5 font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comparison chart ───────────────────────────────────────────────────────────

export interface ComparisonScenario {
  name: string;
  histogram: HistogramBin[];
  percentiles: SimulationResultsPercentiles;
  color: string;
}

export interface ComparisonChartProps {
  scenarios: ComparisonScenario[];
}

export function ComparisonChart({ scenarios }: ComparisonChartProps) {
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          setThemeVersion((v) => v + 1);
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const option = useMemo((): EChartsOption => {
    void themeVersion;
    const c = getThemeColors();

    const series = scenarios.map((s) => {
      const total = s.histogram.reduce((sum, b) => sum + b.count, 0);
      const curve = buildExceedanceCurve(s.histogram, total);

      return {
        type: "line" as const,
        name: s.name,
        data: curve,
        smooth: true,
        symbol: "none",
        lineStyle: { color: s.color, width: 2 },
        areaStyle: { color: s.color, opacity: 0.15 },
      };
    });

    return {
      backgroundColor: "transparent",
      animation: true,
      legend: {
        bottom: 4,
        textStyle: { color: c.mutedForeground, fontSize: 11 },
        data: scenarios.map((s) => ({ name: s.name })),
      },
      grid: {
        top: 24,
        right: 16,
        bottom: 60,
        left: 56,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: c.background,
        borderColor: c.border,
        textStyle: { color: c.foreground, fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = params as Array<{ seriesName: string; value: [number, number] }>;
          if (!arr.length) return "";
          const x = arr[0].value[0];
          const lines = arr.map(
            (p) => `${p.seriesName}: ${(p.value[1] * 100).toFixed(1)}%`
          );
          return `${formatUSD(x)}<br/>${lines.join("<br/>")}`;
        },
      },
      xAxis: {
        type: "value",
        name: "Annual Loss ($)",
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: { color: c.mutedForeground, fontSize: 11 },
        axisLine: { lineStyle: { color: c.border } },
        splitLine: { lineStyle: { color: c.muted, type: "dashed" } },
        axisLabel: {
          color: c.mutedForeground,
          fontSize: 10,
          formatter: (v: number) => formatUSD(v),
        },
      },
      yAxis: {
        type: "value",
        name: "P(Exceedance)",
        nameLocation: "middle",
        nameGap: 44,
        nameTextStyle: { color: c.mutedForeground, fontSize: 11 },
        min: 0,
        max: 1,
        axisLine: { lineStyle: { color: c.border } },
        splitLine: { lineStyle: { color: c.muted, type: "dashed" } },
        axisLabel: {
          color: c.mutedForeground,
          fontSize: 10,
          formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
        },
      },
      series,
    };
  }, [themeVersion, scenarios]);

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: 400 }}
      notMerge={true}
      lazyUpdate={false}
    />
  );
}
