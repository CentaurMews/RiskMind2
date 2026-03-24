import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Info, X } from "lucide-react";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RiskHeatmapChart } from "@/components/dashboard/risk-heatmap-chart";
import { KriTrendPanel } from "@/components/dashboard/kri-trend-panel";
import { RiskPostureBar } from "@/components/dashboard/risk-posture-bar";
import { DomainCard } from "@/components/dashboard/domain-card";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RiskCell {
  likelihood: number;
  impact: number;
  risks: Array<{ id: string; title: string; status: string; category: string; likelihood: number; impact: number }>;
}

interface DomainSummary {
  category: string;
  displayName: string;
  score: number;
  highCriticalCount: number;
  sparklineData: Array<{ month: string; score: number }>;
}

interface AppetiteConfig {
  category: string;
  threshold: number;
}

interface DashboardData {
  postureScore: number;
  aboveAppetiteCount: number;
  aboveAppetiteDelta: number | null;
  cellDeltas: Record<string, number>;
  aboveAppetiteCells: string[];
  domainSummaries: DomainSummary[];
  cells: RiskCell[];
  appetiteConfigs: AppetiteConfig[];
  collecting?: boolean;
}

interface SnapshotEntry {
  date: string;
  compositeScore: number;
  aboveAppetiteCount: number;
  totalRisks: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_DISPLAY: Record<string, string> = {
  technology: "Cyber",
  operational: "Ops",
  compliance: "Compliance",
  financial: "Financial",
  strategic: "Strategic",
  reputational: "Reputational",
};

function computeSeverity(l: number, i: number): "critical" | "high" | "medium" | "low" {
  const score = l * i;
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function deriveDomainRiskLevel(score: number): "Low" | "Medium" | "High" | "Critical" {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RiskHeatmap() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [snapshotData, setSnapshotData] = useState<SnapshotEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<"3M" | "6M" | "12M">("6M");
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [aboveAppetiteFilter, setAboveAppetiteFilter] = useState(false);

  // URL deep linking: read ?l=X&i=Y on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = params.get("l");
    const i = params.get("i");
    if (l && i) setSelectedCell({ likelihood: Number(l), impact: Number(i) });
  }, []);

  // Fetch dashboard data (re-fetch when activeDomain changes)
  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = activeDomain
        ? `/api/v1/risks/dashboard?category=${activeDomain}`
        : `/api/v1/risks/dashboard`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (_err) {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [activeDomain]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Fetch snapshot data (re-fetch when selectedRange changes)
  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const res = await fetch(`/api/v1/risks/snapshots?range=${selectedRange}`, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } });
        if (res.ok) {
          const data = await res.json();
          setSnapshotData(data.snapshots || []);
        }
      } catch (_err) {
        // silently handle
      }
    }
    fetchSnapshots();
  }, [selectedRange]);

  // Computed values
  const globalAppetiteThreshold = dashboardData?.appetiteConfigs?.length
    ? Math.round(
        dashboardData.appetiteConfigs.reduce((sum, c) => sum + c.threshold, 0) /
          dashboardData.appetiteConfigs.length
      )
    : 60;

  const aboveAppetiteCellsSet = new Set<string>(dashboardData?.aboveAppetiteCells || []);

  const filteredCells: RiskCell[] = aboveAppetiteFilter
    ? (dashboardData?.cells || []).filter((cell) =>
        aboveAppetiteCellsSet.has(`${cell.likelihood}-${cell.impact}`)
      )
    : dashboardData?.cells || [];

  const selectedCellData = selectedCell
    ? (dashboardData?.cells || []).find(
        (c) => c.likelihood === selectedCell.likelihood && c.impact === selectedCell.impact
      )
    : null;
  const selectedRisks = selectedCellData?.risks || [];

  // Mobile severity counts
  const mobileCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  (dashboardData?.cells || []).forEach((cell) => {
    const score = cell.likelihood * cell.impact;
    const count = cell.risks?.length || 0;
    if (score >= 15) mobileCounts.critical += count;
    else if (score >= 10) mobileCounts.high += count;
    else if (score >= 5) mobileCounts.medium += count;
    else mobileCounts.low += count;
  });

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risk Dashboard</h1>
          <p className="text-muted-foreground mt-1">Enterprise risk posture at a glance</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : (
          <>
            {/* SECTION 1: Top KPI Strip */}
            <div className="flex flex-col sm:flex-row items-stretch gap-4">

              {/* Posture bar card */}
              <div className="flex-1 bg-card border rounded-xl p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">Risk Posture Index</div>
                <RiskPostureBar
                  score={dashboardData?.postureScore ?? 0}
                  appetiteThreshold={globalAppetiteThreshold}
                  onClick={() => setShowExplanation(true)}
                />
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Click for calculation details
                </div>
              </div>

              {/* Above-appetite pill */}
              <div
                className={cn(
                  "flex items-center gap-3 bg-card border rounded-xl px-5 py-3 cursor-pointer transition-colors",
                  aboveAppetiteFilter
                    ? "ring-2 ring-severity-critical bg-severity-critical/5"
                    : "hover:bg-muted/50"
                )}
                onClick={() => setAboveAppetiteFilter((prev) => !prev)}
                role="button"
                tabIndex={0}
                aria-pressed={aboveAppetiteFilter}
                aria-label={`${dashboardData?.aboveAppetiteCount ?? 0} risks above appetite. Click to filter heatmap.`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setAboveAppetiteFilter((prev) => !prev);
                  }
                }}
              >
                <AlertCircle className="h-5 w-5 text-severity-critical flex-shrink-0" />
                <div>
                  <div className="text-2xl font-bold">{dashboardData?.aboveAppetiteCount ?? 0}</div>
                  <div className="text-xs text-muted-foreground">above appetite</div>
                </div>
                {dashboardData?.aboveAppetiteDelta != null && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      dashboardData.aboveAppetiteDelta > 0
                        ? "text-severity-critical"
                        : dashboardData.aboveAppetiteDelta < 0
                        ? "text-severity-low"
                        : "text-muted-foreground"
                    )}
                  >
                    {dashboardData.aboveAppetiteDelta > 0 ? "+" : ""}
                    {dashboardData.aboveAppetiteDelta}
                  </span>
                )}
              </div>
            </div>

            {/* SECTION 2: Split main content */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Left: Heatmap (60% = 3/5 cols) */}
              <div className="lg:col-span-3 bg-card border rounded-2xl p-6 shadow-sm">

                {/* Filter badges */}
                {(aboveAppetiteFilter || activeDomain) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {aboveAppetiteFilter && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-severity-critical/10 text-severity-critical border border-severity-critical/20">
                        Showing above-appetite only
                        <button
                          className="hover:opacity-70"
                          onClick={() => setAboveAppetiteFilter(false)}
                          aria-label="Clear above-appetite filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {activeDomain && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        Filtered: {CATEGORY_DISPLAY[activeDomain] ?? activeDomain}
                        <button
                          className="hover:opacity-70"
                          onClick={() => setActiveDomain(null)}
                          aria-label="Clear domain filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {/* Mobile: severity summary */}
                <div className="md:hidden space-y-2 w-full min-h-[200px]">
                  {[
                    { label: "Critical", count: mobileCounts.critical, className: "text-severity-critical bg-severity-critical/10 border-severity-critical/30" },
                    { label: "High", count: mobileCounts.high, className: "text-severity-high bg-severity-high/10 border-severity-high/30" },
                    { label: "Medium", count: mobileCounts.medium, className: "text-foreground bg-severity-medium/10 border-severity-medium/30" },
                    { label: "Low", count: mobileCounts.low, className: "text-muted-foreground bg-severity-low/10 border-severity-low/30" },
                  ].map(({ label, count, className: cls }) => (
                    <div key={label} className={cn("flex items-center justify-between px-3 py-2 rounded-md border font-mono text-sm", cls)}>
                      <span className="font-medium">{label}</span>
                      <span className="font-bold">{count} risk{count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>

                {/* Desktop: ECharts heatmap */}
                <div className="hidden md:block w-full" style={{ minHeight: 400 }}>
                  <RiskHeatmapChart
                    cells={filteredCells as Array<{ likelihood: number; impact: number; risks: Array<{ id: string; title: string; status: string; category: string }> }>}
                    cellDeltas={dashboardData?.cellDeltas}
                    aboveAppetiteCells={aboveAppetiteCellsSet}
                    onCellClick={(l, i) => setSelectedCell({ likelihood: l, impact: i })}
                    selectedCell={selectedCell}
                  />
                </div>
              </div>

              {/* Right: KRI Trend (40% = 2/5 cols) */}
              <div className="lg:col-span-2 bg-card border rounded-2xl p-6 shadow-sm">
                <KriTrendPanel
                  snapshots={snapshotData}
                  appetiteThreshold={globalAppetiteThreshold}
                  selectedRange={selectedRange}
                  onRangeChange={setSelectedRange}
                  collecting={dashboardData?.collecting}
                />
              </div>
            </div>

            {/* SECTION 3: Domain Cards Strip */}
            {(dashboardData?.domainSummaries || []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {(dashboardData?.domainSummaries || []).map((domain) => (
                  <DomainCard
                    key={domain.category}
                    category={domain.category}
                    displayName={domain.displayName || CATEGORY_DISPLAY[domain.category] || domain.category}
                    riskLevel={deriveDomainRiskLevel(domain.score)}
                    highCriticalCount={domain.highCriticalCount}
                    sparklineData={domain.sparklineData || []}
                    isActive={activeDomain === domain.category}
                    onClick={() =>
                      setActiveDomain((prev) =>
                        prev === domain.category ? null : domain.category
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Explanation panel */}
      <Sheet open={showExplanation} onOpenChange={setShowExplanation}>
        <SheetContent className="sm:max-w-md w-full border-l overflow-y-auto">
          <SheetHeader>
            <SheetTitle>How Risk Posture Index is Calculated</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              The Risk Posture Index is a weighted average of all active risk scores (open + mitigated),
              normalized to a 0-100 scale.
            </p>
            <p>
              <strong className="text-foreground">Formula:</strong> Each risk's inherent score = Likelihood &times; Impact
              (1-25), normalized to 0-100. Critical/High risks (score &ge; 15) are weighted 2&times;.
            </p>
            <p>
              <strong className="text-foreground">Appetite threshold:</strong>{" "}
              {globalAppetiteThreshold}. Risks in categories above their appetite threshold are flagged.
            </p>
            <p>
              Current score:{" "}
              <strong className="text-foreground">{dashboardData?.postureScore ?? 0}</strong>
            </p>
            {dashboardData?.collecting && (
              <p className="text-amber-600 dark:text-amber-400">
                Trend data is still being collected. First snapshot arrives at midnight UTC.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cell drill-down Sheet */}
      <Sheet
        open={!!selectedCell}
        onOpenChange={(open) => {
          if (!open) setSelectedCell(null);
        }}
      >
        <SheetContent className="sm:max-w-lg w-full border-l overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SeverityBadge
                severity={
                  selectedCell
                    ? computeSeverity(selectedCell.likelihood, selectedCell.impact)
                    : "low"
                }
              />
              L{selectedCell?.likelihood} &times; I{selectedCell?.impact} &mdash;{" "}
              {selectedRisks.length} Risk{selectedRisks.length !== 1 ? "s" : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {selectedRisks.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No risks in this cell.</div>
            ) : (
              selectedRisks.map((risk) => (
                <Link key={risk.id} href={`/risks/${risk.id}`}>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {risk.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        L:{risk.likelihood ?? selectedCell?.likelihood} I:{risk.impact ?? selectedCell?.impact}
                      </span>
                      <span>&middot;</span>
                      <span className="capitalize">{risk.category}</span>
                      <span>&middot;</span>
                      <span className="capitalize">{risk.status}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
