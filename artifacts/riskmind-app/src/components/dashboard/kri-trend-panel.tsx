import { useEffect, useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils";

interface KriTrendPanelProps {
  snapshots: Array<{ date: string; compositeScore: number; aboveAppetiteCount: number }>;
  appetiteThreshold: number;           // horizontal band upper bound
  annotations?: Array<{ date: string; label: string }>; // event dots
  selectedRange: "3M" | "6M" | "12M";  // time range
  onRangeChange: (range: "3M" | "6M" | "12M") => void;
  collecting?: boolean;                 // true if no snapshots yet
  className?: string;
}

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
  };
}

export function KriTrendPanel({
  snapshots,
  appetiteThreshold,
  annotations,
  selectedRange,
  onRangeChange,
  collecting,
  className,
}: KriTrendPanelProps) {
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

  // Recalculate theme colors whenever themeVersion changes
  const colors = useMemo(() => {
    void themeVersion;
    return getThemeColors();
  }, [themeVersion]);

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    // Map snapshots to [timestamp, score] pairs
    const lineData = snapshots.map((s) => [new Date(s.date).getTime(), s.compositeScore]);

    // Build markPoint data for annotations
    const annotationPoints =
      annotations && annotations.length > 0
        ? annotations.map((a) => {
            // Find closest snapshot score for y-coordinate
            const ts = new Date(a.date).getTime();
            const closest = snapshots.reduce(
              (prev, curr) => {
                const prevDiff = Math.abs(new Date(prev.date).getTime() - ts);
                const currDiff = Math.abs(new Date(curr.date).getTime() - ts);
                return currDiff < prevDiff ? curr : prev;
              },
              snapshots[0] ?? { date: a.date, compositeScore: appetiteThreshold, aboveAppetiteCount: 0 }
            );
            return {
              name: a.label,
              coord: [new Date(a.date).getTime(), closest.compositeScore],
              symbol: "circle",
              symbolSize: 8,
              itemStyle: { color: colors.primary },
              label: { formatter: a.label, show: false },
            };
          })
        : undefined;

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (!p) return "";
          const [ts, score] = p.value as [number, number];
          const date = new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
          return `${date}<br/>Composite Risk Index: <strong>${score}</strong>`;
        },
      },
      grid: { top: 30, right: 20, bottom: 30, left: 40 },
      xAxis: {
        type: "time",
        axisLabel: {
          color: colors.mutedForeground,
          fontSize: 11,
          formatter: (value: number) =>
            new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: colors.muted } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { color: colors.mutedForeground, fontSize: 11 },
        splitLine: { lineStyle: { color: colors.muted, type: "dashed" } },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: "line",
          data: lineData,
          smooth: false,
          lineStyle: { color: colors.primary, width: 2 },
          itemStyle: { color: colors.primary },
          symbol: "circle",
          symbolSize: 4,
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(34, 197, 94, 0.08)" },
            data: [[{ yAxis: 0 }, { yAxis: appetiteThreshold }]],
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: colors.mutedForeground, type: "dashed", width: 1 },
            data: [{ yAxis: appetiteThreshold, label: { formatter: `Appetite: ${appetiteThreshold}`, fontSize: 10, color: colors.mutedForeground } }],
          },
          ...(annotationPoints && annotationPoints.length > 0
            ? {
                markPoint: {
                  data: annotationPoints,
                },
              }
            : {}),
        },
      ],
    };
  }, [snapshots, appetiteThreshold, annotations, colors]);

  const ranges: Array<"3M" | "6M" | "12M"> = ["3M", "6M", "12M"];

  if (collecting) {
    return (
      <div
        className={cn("flex flex-col gap-4", className)}
        aria-label={`Composite risk index trend over ${selectedRange}`}
      >
        {/* Range switcher */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Composite Risk Index</span>
          <div className="inline-flex rounded-lg bg-muted p-1">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  selectedRange === r
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Collecting empty state */}
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
          <svg
            className="h-10 w-10 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2m4-2a8 8 0 11-16 0 8 8 0 0116 0z"
            />
          </svg>
          <p className="text-sm font-medium">Collecting trend data</p>
          <p className="text-xs text-muted-foreground/70">First snapshot arrives at midnight UTC</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header with range switcher */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Composite Risk Index</span>
        <div className="inline-flex rounded-lg bg-muted p-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                selectedRange === r
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        aria-label={`Composite risk index trend over ${selectedRange}`}
        style={{ minHeight: 300 }}
      >
        <ReactECharts
          option={option}
          style={{ height: "100%", minHeight: 300 }}
          opts={{ renderer: "canvas" }}
        />
      </div>
    </div>
  );
}
