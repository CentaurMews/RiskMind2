import { useEffect, useRef, useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface RiskHeatmapChartProps {
  cells: Array<{
    likelihood: number;
    impact: number;
    risks: Array<{ id: string; title: string; status: string; category: string }>;
  }>;
  onCellClick?: (likelihood: number, impact: number) => void;
  selectedCell?: { likelihood: number; impact: number } | null;
}

function hslStringToColor(hslValue: string): string {
  // Convert "H S% L%" format (CSS variable value) to "hsl(H, S%, L%)" for ECharts
  const trimmed = hslValue.trim();
  // Handle both "0 84% 60%" and "0 84% 60%" (with or without %)
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
    severityCritical: hslStringToColor(getCssVar("--severity-critical")),
    severityHigh: hslStringToColor(getCssVar("--severity-high")),
    severityMedium: hslStringToColor(getCssVar("--severity-medium")),
    severityLow: hslStringToColor(getCssVar("--severity-low")),
    muted: hslStringToColor(getCssVar("--muted")),
    mutedForeground: hslStringToColor(getCssVar("--muted-foreground")),
    foreground: hslStringToColor(getCssVar("--foreground")),
    card: hslStringToColor(getCssVar("--card")),
  };
}

function getSeverityColor(
  likelihoodIndex: number,
  impactIndex: number,
  colors: ReturnType<typeof getThemeColors>
): string {
  const likelihood = likelihoodIndex + 1;
  const impact = impactIndex + 1;
  const score = likelihood * impact;
  if (score >= 15) return colors.severityCritical;
  if (score >= 10) return colors.severityHigh;
  if (score >= 5) return colors.severityMedium;
  return colors.severityLow;
}

export function RiskHeatmapChart({ cells, onCellClick, selectedCell }: RiskHeatmapChartProps) {
  const echartsRef = useRef<ReactECharts>(null);
  const [themeVersion, setThemeVersion] = useState(0);

  // MutationObserver to detect dark/light mode toggle via .dark class
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
    // themeVersion in deps ensures recomputation on theme change
    void themeVersion;
    return getThemeColors();
  }, [themeVersion]);

  // Build 5x5 heatmap data: [impactIndex, likelihoodIndex, count]
  // impactIndex = impact - 1 (0-4), likelihoodIndex = likelihood - 1 (0-4)
  const heatmapData = useMemo(() => {
    const data: [number, number, number][] = [];
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        const cell = cells.find((c) => c.likelihood === l && c.impact === i);
        const count = cell?.risks?.length ?? 0;
        // ECharts heatmap: x = impact index, y = likelihood index
        data.push([i - 1, l - 1, count]);
      }
    }
    return data;
  }, [cells]);

  const option: EChartsOption = useMemo(() => {
    const likelihoodLabels = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
    const impactLabels = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

    return {
      tooltip: {
        position: "top",
        formatter: (params: any) => {
          const [iIdx, lIdx, count] = params.value as [number, number, number];
          const likelihood = lIdx + 1;
          const impact = iIdx + 1;
          const score = likelihood * impact;
          const severityLabel =
            score >= 15 ? "Critical" : score >= 10 ? "High" : score >= 5 ? "Medium" : "Low";
          return (
            `<strong>${severityLabel}</strong> (Score: ${score})<br/>` +
            `Likelihood: ${likelihoodLabels[lIdx]}<br/>` +
            `Impact: ${impactLabels[iIdx]}<br/>` +
            `Risks: <strong>${count}</strong>`
          );
        },
      },
      grid: { top: 10, right: 10, bottom: 60, left: 80, containLabel: false },
      xAxis: {
        type: "category",
        data: ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"],
        name: "Impact",
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: { fontWeight: "bold", fontSize: 13, color: colors.mutedForeground },
        splitArea: { show: false },
        axisLabel: { color: colors.mutedForeground, fontSize: 11 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"],
        name: "Likelihood",
        nameLocation: "middle",
        nameGap: 60,
        nameTextStyle: { fontWeight: "bold", fontSize: 13, color: colors.mutedForeground },
        splitArea: { show: false },
        axisLabel: { color: colors.mutedForeground, fontSize: 11 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: "heatmap",
          data: heatmapData,
          label: {
            show: true,
            formatter: (params: any) => {
              const count = (params.value as [number, number, number])[2];
              return count > 0 ? String(count) : "";
            },
            fontSize: 14,
            fontWeight: "bold",
            color: colors.foreground,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
          itemStyle: {
            borderRadius: 4,
            borderColor: "transparent",
            borderWidth: 2,
            color: (params: any) => {
              const [iIdx, lIdx, count] = params.value as [number, number, number];
              if (count === 0) return colors.muted;
              return getSeverityColor(lIdx, iIdx, colors);
            },
          },
        },
      ],
    };
  }, [heatmapData, colors]);

  // Dispatch highlight action for selected cell
  useEffect(() => {
    const instance = echartsRef.current?.getEchartsInstance();
    if (!instance) return;
    if (selectedCell) {
      instance.dispatchAction({
        type: "highlight",
        seriesIndex: 0,
        dataIndex: (selectedCell.likelihood - 1) * 5 + (selectedCell.impact - 1),
      });
    }
  }, [selectedCell]);

  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (params.componentType === "series") {
          const [iIdx, lIdx] = params.value as [number, number, number];
          onCellClick?.(lIdx + 1, iIdx + 1);
        }
      },
    }),
    [onCellClick]
  );

  return (
    <ReactECharts
      ref={echartsRef}
      option={option}
      onEvents={onEvents}
      style={{ height: "100%", minHeight: 500 }}
      opts={{ renderer: "canvas" }}
    />
  );
}
