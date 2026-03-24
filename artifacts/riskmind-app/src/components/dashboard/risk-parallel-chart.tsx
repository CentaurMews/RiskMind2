import { useEffect, useRef, useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RiskParallelChartProps {
  risks: Array<{
    id: string;
    title: string;
    status: string;
    category: string;
    likelihood: number;
    impact: number;
  }>;
  onRiskClick?: (riskId: string) => void;
}

// ── Category / Status mappings ─────────────────────────────────────────────────

const CATEGORY_INDEX: Record<string, number> = {
  technology: 0,
  operational: 1,
  compliance: 2,
  financial: 3,
  strategic: 4,
  reputational: 5,
};

const CATEGORY_LABELS = ["Cyber", "Ops", "Compliance", "Financial", "Strategic", "Reputational"];

const STATUS_INDEX: Record<string, number> = {
  open: 0,
  mitigated: 1,
};

const STATUS_LABELS = ["Open", "Mitigated"];

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

function getSeverityColorByScore(
  score: number,
  colors: ReturnType<typeof getThemeColors>
): string {
  if (score >= 15) return colors.severityCritical;
  if (score >= 10) return colors.severityHigh;
  if (score >= 5) return colors.severityMedium;
  return colors.severityLow;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RiskParallelChart({ risks, onRiskClick }: RiskParallelChartProps) {
  const echartsRef = useRef<ReactECharts>(null);
  const [themeVersion, setThemeVersion] = useState(0);

  // MutationObserver: detect dark/light mode toggle via .dark class on <html>
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

  // Recompute theme colors whenever themeVersion changes (dark mode toggle)
  const colors = useMemo(() => {
    void themeVersion; // reactive dependency
    return getThemeColors();
  }, [themeVersion]);

  // Build parallel data rows and riskIdMap (index → risk.id) in one pass
  const { parallelData, riskIdMap } = useMemo(() => {
    // Count risks per category for the "Risk Count per Category" axis
    const categoryCount: Record<string, number> = {};
    for (const risk of risks) {
      const key = risk.category?.toLowerCase() || "operational";
      categoryCount[key] = (categoryCount[key] ?? 0) + 1;
    }

    const rows: number[][] = [];
    const ids: string[] = [];

    for (const risk of risks) {
      const likelihood = Math.max(1, Math.min(5, risk.likelihood ?? 1));
      const impact = Math.max(1, Math.min(5, risk.impact ?? 1));
      const score = likelihood * impact;
      const categoryKey = risk.category?.toLowerCase() || "operational";
      const categoryIdx = CATEGORY_INDEX[categoryKey] ?? 1;
      const statusKey = risk.status?.toLowerCase() || "open";
      const statusIdx = STATUS_INDEX[statusKey] ?? 0;
      const riskCount = categoryCount[categoryKey] ?? 1;

      // Axis order: Likelihood | Impact | Score | Category | Status | Risk Count per Category
      rows.push([likelihood, impact, score, categoryIdx, statusIdx, riskCount]);
      ids.push(risk.id);
    }

    return { parallelData: rows, riskIdMap: ids };
  }, [risks]);

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    // Per-line item styles: color by severity (score = row[2])
    const seriesData = parallelData.map((row) => ({
      value: row,
      lineStyle: {
        color: getSeverityColorByScore(row[2], colors),
        opacity: 0.35,
        width: 1.5,
      },
    }));

    return {
      backgroundColor: "transparent",

      // Parallel coordinate system layout
      parallel: {
        left: 48,
        right: 48,
        top: 40,
        bottom: 32,
        parallelAxisDefault: {
          nameLocation: "start",
          nameGap: 20,
          nameTextStyle: {
            color: colors.mutedForeground,
            fontSize: 11,
            fontWeight: 600,
          },
          axisLabel: {
            color: colors.mutedForeground,
            fontSize: 10,
          },
          axisLine: {
            lineStyle: {
              color: colors.muted,
              width: 1,
            },
          },
          axisTick: {
            lineStyle: { color: colors.muted },
          },
          splitLine: { show: false },
          // Brush selection styling
          areaSelectStyle: {
            width: 20,
            borderWidth: 1,
            borderColor: colors.mutedForeground,
            color: colors.mutedForeground,
            opacity: 0.15,
          },
        },
      },

      // 6 parallel axes
      parallelAxis: [
        {
          dim: 0,
          name: "Likelihood",
          min: 1,
          max: 5,
          type: "value",
          interval: 1,
        },
        {
          dim: 1,
          name: "Impact",
          min: 1,
          max: 5,
          type: "value",
          interval: 1,
        },
        {
          dim: 2,
          name: "Score",
          min: 1,
          max: 25,
          type: "value",
          interval: 5,
        },
        {
          dim: 3,
          name: "Category",
          type: "category",
          data: CATEGORY_LABELS,
        },
        {
          dim: 4,
          name: "Status",
          type: "category",
          data: STATUS_LABELS,
        },
        {
          dim: 5,
          name: "Count / Cat.",
          min: 0,
          type: "value",
          minInterval: 1,
        },
      ],

      // Tooltip on hover
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const idx: number = params.dataIndex;
          if (idx == null || idx < 0 || idx >= risks.length) return "";
          const risk = risks[idx];
          const row = parallelData[idx];
          if (!row) return "";
          const score = row[2];
          const severityLabel =
            score >= 15 ? "Critical" : score >= 10 ? "High" : score >= 5 ? "Medium" : "Low";
          const categoryKey = risk.category?.toLowerCase() || "operational";
          const catIdx = CATEGORY_INDEX[categoryKey] ?? 1;
          const catLabel = CATEGORY_LABELS[catIdx] ?? risk.category;
          const statusKey = risk.status?.toLowerCase() || "open";
          const statusIdx = STATUS_INDEX[statusKey] ?? 0;
          const statusLabel = STATUS_LABELS[statusIdx] ?? risk.status;
          return (
            `<div style="font-size:12px;line-height:1.6">` +
            `<strong>${risk.title}</strong><br/>` +
            `Score: <strong>${score}</strong> (${risk.likelihood} &times; ${risk.impact}) &mdash; ${severityLabel}<br/>` +
            `Category: ${catLabel}<br/>` +
            `Status: ${statusLabel}` +
            `</div>`
          );
        },
      },

      // Parallel series
      series: [
        {
          type: "parallel",
          smooth: true,
          lineStyle: {
            width: 1.5,
            opacity: 0.35,
          },
          emphasis: {
            lineStyle: {
              width: 2.5,
              opacity: 0.9,
            },
          },
          inactiveOpacity: 0.05,
          activeOpacity: 0.9,
          data: seriesData,
        },
      ],
    };
  }, [parallelData, colors, risks]);

  // Click handler: map dataIndex back to risk ID
  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (params.componentType === "series") {
          const idx: number = params.dataIndex;
          const riskId = riskIdMap[idx];
          if (riskId) {
            onRiskClick?.(riskId);
          }
        }
      },
    }),
    [riskIdMap, onRiskClick]
  );

  const totalRisks = risks.length;

  return (
    <div
      aria-label={`Parallel coordinates Risk Explorer with ${totalRisks} risks across 6 axes`}
      style={{ height: "100%" }}
    >
      <ReactECharts
        ref={echartsRef}
        option={option}
        onEvents={onEvents}
        style={{ height: "100%", minHeight: 480 }}
        opts={{ renderer: "canvas" }}
        notMerge={false}
        lazyUpdate={false}
      />
    </div>
  );
}
