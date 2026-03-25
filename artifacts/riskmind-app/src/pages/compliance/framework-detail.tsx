import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetFramework, useGetComplianceScore, useGetGapAnalysis, useAiGapRemediation, useGetMe } from "@workspace/api-client-react";
import type { GapRequirement } from "@workspace/api-client-react";
import { InterviewDialog } from "@/components/ai-interview/interview-dialog";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, MinusCircle, ChevronRight, FlaskConical, Shield, Sparkles, Clock, Check, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

// Extended ComplianceScore type with status field added in Plan 02
interface ComplianceScoreExtended {
  frameworkId?: string;
  frameworkName?: string;
  totalRequirements?: number;
  coveredRequirements?: number;
  coverageScore?: number;
  effectivenessScore?: number;
  score?: number;
  totalControls?: number;
  passedControls?: number;
  status?: "COMPLIANT" | "AT-RISK" | "NON-COMPLIANT" | null;
}

// Extended Framework type with complianceThreshold added in Plan 02
interface FrameworkExtended {
  id?: string;
  name?: string;
  version?: string | null;
  type?: string | null;
  description?: string | null;
  createdAt?: string;
  complianceThreshold?: number | null;
}

const STATUS_BADGE: Record<string, string> = {
  COMPLIANT: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300",
  "AT-RISK": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300",
  "NON-COMPLIANT": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300",
};

function buildTree(requirements: GapRequirement[]): (GapRequirement & { children: GapRequirement[] })[] {
  const map = new Map<string, GapRequirement & { children: GapRequirement[] }>();
  const roots: (GapRequirement & { children: GapRequirement[] })[] = [];

  for (const req of requirements) {
    map.set(req.requirementId || "", { ...req, children: [] });
  }

  for (const req of requirements) {
    const node = map.get(req.requirementId || "")!;
    if (req.parentId && map.has(req.parentId)) {
      map.get(req.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "covered") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "partial") return <MinusCircle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
}

function TestResultBadge({ result }: { result?: string }) {
  if (!result) return <span className="text-xs text-muted-foreground">-</span>;
  const colors: Record<string, string> = {
    pass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    fail: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    not_tested: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", colors[result] || colors.not_tested)}>
      {result.replace("_", " ")}
    </span>
  );
}

function RequirementTreeNode({ node, depth = 0 }: { node: GapRequirement & { children: GapRequirement[] }; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-start gap-3 py-2.5 px-4 hover:bg-muted/30 transition-colors border-b last:border-b-0",
        )}
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="pt-0.5 shrink-0">
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        <StatusIcon status={node.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold bg-secondary px-1.5 py-0.5 rounded border">{node.code}</span>
            <span className="text-sm font-medium">{node.title}</span>
          </div>
          {node.controls && node.controls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {node.controls.map(c => (
                <span key={c.id} className="text-[11px] bg-muted border px-2 py-0.5 rounded font-medium inline-flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  {c.title}
                  <TestResultBadge result={c.testResult} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <RequirementTreeNode key={child.requirementId} node={child as typeof node} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface RemediationStep {
  gap: string;
  priority: string;
  steps: string;
  effortDays: number;
  suggestedControls: string[];
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function FrameworkDetail() {
  const [, params] = useRoute("/compliance/:id");
  const id = params?.id || "";
  const [remediations, setRemediations] = useState<RemediationStep[]>([]);
  const [assessingControl, setAssessingControl] = useState<{ id: string; title: string } | null>(null);

  // Threshold editor state
  const [thresholdValue, setThresholdValue] = useState<string>("");
  const [isThresholdEditing, setIsThresholdEditing] = useState(false);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { queryKey: ["/api/v1/auth/me"] } });
  const canEdit = user?.role === "admin" || user?.role === "risk_manager";

  const { data: framework, isLoading: isFwLoading } = useGetFramework(id);
  const { data: score } = useGetComplianceScore(id);
  const { data: gaps } = useGetGapAnalysis(id);

  const remediationMutation = useAiGapRemediation();

  // Cast to extended types that include fields added in Plan 02
  const fw = framework as FrameworkExtended | undefined;
  const scoreExt = score as ComplianceScoreExtended | undefined;

  if (isFwLoading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div></AppLayout>;
  if (!framework) return <AppLayout><div className="p-8 text-center text-muted-foreground">Framework not found</div></AppLayout>;

  const coveragePercent = scoreExt?.coverageScore || 0;
  const scoreValue = scoreExt?.score || 0;
  const complianceStatus = scoreExt?.status;
  const currentThreshold = fw?.complianceThreshold;
  const summary = gaps?.summary;
  const requirements = gaps?.requirements || [];
  const tree = buildTree(requirements);

  const allControls = requirements.flatMap(r => r.controls || []);
  const testResults = {
    pass: allControls.filter(c => c.testResult === "pass").length,
    fail: allControls.filter(c => c.testResult === "fail").length,
    notTested: allControls.filter(c => !c.testResult || c.testResult === "not_tested").length,
  };

  const gapRequirements = requirements.filter(r => r.status === "gap" || r.status === "partial");

  async function handleSaveThreshold() {
    const val = parseInt(thresholdValue, 10);
    if (isNaN(val) || val < 0 || val > 100) {
      toast({ variant: "destructive", title: "Threshold must be a number between 0 and 100." });
      return;
    }
    setIsSavingThreshold(true);
    try {
      const res = await fetch(`/api/v1/frameworks/${id}/threshold`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ threshold: val }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to save threshold" }));
        throw new Error(err.message || "Failed to save threshold");
      }
      toast({ title: "Compliance threshold updated." });
      setIsThresholdEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/compliance/frameworks/${id}/score`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/compliance/frameworks/${id}`] });
    } catch (err) {
      toast({ variant: "destructive", title: (err as Error).message || "Failed to update threshold." });
    } finally {
      setIsSavingThreshold(false);
    }
  }

  function handleExportCsv() {
    const link = document.createElement("a");
    link.href = `/api/v1/frameworks/${id}/export/csv`;
    link.download = `${framework?.name || "framework"}-export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleGetRemediation = () => {
    if (gapRequirements.length === 0) return;
    const gapDescriptions = gapRequirements.map(r =>
      `${r.code}: ${r.title}${r.controls?.length === 0 ? " (no controls mapped)" : " (controls need improvement)"}`
    );
    remediationMutation.mutate(
      { frameworkId: id, data: { gaps: gapDescriptions } },
      {
        onSuccess: (result) => {
          const r = result as { remediations?: RemediationStep[] };
          setRemediations(r.remediations || []);
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/compliance">Compliance</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{framework?.name ?? "Framework Detail"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/compliance">
              <Button variant="outline" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="font-mono text-sm text-muted-foreground">{framework.name} {framework.version}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm bg-sidebar text-white border-none">
            <CardContent className="p-8 flex flex-col justify-center h-full">
              <h1 className="text-4xl font-bold tracking-tight mb-2">{framework.name}</h1>
              <p className="text-sidebar-foreground/70 max-w-2xl">{framework.description}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t-4 border-t-emerald-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">Compliance Score</CardTitle>
                {complianceStatus && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase font-bold", STATUS_BADGE[complianceStatus])}
                  >
                    {complianceStatus.replace("-", " ")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-end gap-2 mb-6">
                <span className="text-5xl font-bold font-mono tracking-tighter">{scoreValue}</span>
                <span className="text-muted-foreground font-medium pb-1">%</span>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span>Requirement Coverage</span>
                    <span>{coveragePercent}%</span>
                  </div>
                  <Progress value={coveragePercent} className="h-2 bg-secondary" />
                </div>
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Mapped Controls</span>
                  <span>{scoreExt?.totalControls || 0}</span>
                </div>

                {/* Threshold editor */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Compliance Threshold</span>
                    {canEdit && !isThresholdEditing && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setThresholdValue(String(currentThreshold ?? ""));
                          setIsThresholdEditing(true);
                        }}
                      >
                        {currentThreshold != null ? "Edit" : "Set"}
                      </button>
                    )}
                  </div>
                  {isThresholdEditing ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={thresholdValue}
                          onChange={(e) => setThresholdValue(e.target.value)}
                          className="w-full border border-input rounded-md px-2.5 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring pr-6"
                          placeholder="0-100"
                          autoFocus
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={handleSaveThreshold}
                        disabled={isSavingThreshold}
                      >
                        {isSavingThreshold ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setIsThresholdEditing(false)}
                        disabled={isSavingThreshold}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm font-mono font-medium">
                      {currentThreshold != null ? `${currentThreshold}%` : (
                        <span className="text-muted-foreground text-xs">Not set</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold font-mono">{summary.total || 0}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">Total Requirements</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold font-mono text-emerald-600">{summary.covered || 0}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">Covered</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-l-4 border-l-yellow-500">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold font-mono text-yellow-600">{summary.partial || 0}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">Partial</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-l-4 border-l-destructive">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold font-mono text-destructive">{summary.gap || 0}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">Gaps</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="requirements" className="w-full">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="requirements" className="data-[state=active]:shadow-sm">
              Requirements Tree
            </TabsTrigger>
            <TabsTrigger value="tests" className="data-[state=active]:shadow-sm">
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              Test Results
            </TabsTrigger>
            <TabsTrigger value="gaps" className="data-[state=active]:shadow-sm">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Gap Analysis
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="requirements" className="m-0">
              <Card className="shadow-sm">
                {tree.length > 0 ? (
                  <div>
                    {tree.map(node => (
                      <RequirementTreeNode key={node.requirementId} node={node} />
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-muted-foreground">No requirements loaded yet.</div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="tests" className="m-0">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    Control Test Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-2xl font-bold text-emerald-600">{testResults.pass}</div>
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Passed</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                      <div className="text-2xl font-bold text-red-600">{testResults.fail}</div>
                      <div className="text-xs font-medium text-red-700 dark:text-red-400">Failed</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-gray-500">{testResults.notTested}</div>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Not Tested</div>
                    </div>
                  </div>

                  {allControls.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Control</TableHead>
                          <TableHead>Requirement</TableHead>
                          <TableHead className="w-[120px]">Test Result</TableHead>
                          <TableHead className="w-[140px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requirements.filter(r => r.controls && r.controls.length > 0).flatMap(r =>
                          (r.controls || []).map(c => (
                            <TableRow key={`${r.requirementId}-${c.id}`} className="group">
                              <TableCell className="font-medium text-sm">{c.title}</TableCell>
                              <TableCell>
                                <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded border">{r.code}</span>
                              </TableCell>
                              <TableCell><TestResultBadge result={c.testResult} /></TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs opacity-0 group-hover:opacity-100 text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all"
                                  onClick={() => c.id && setAssessingControl({ id: c.id, title: c.title || "" })}
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Assess with AI
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">No control test results available.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gaps" className="m-0 space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Gap Analysis — {gapRequirements.length} requirement{gapRequirements.length !== 1 ? "s" : ""} need attention
                    </CardTitle>
                  </div>
                  {gapRequirements.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGetRemediation}
                      disabled={remediationMutation.isPending}
                    >
                      {remediationMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Get AI Remediation Plan
                    </Button>
                  )}
                </CardHeader>
                <div className="divide-y">
                  {gapRequirements.map(req => (
                    <div key={req.requirementId} className="p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                      <div className="pt-0.5">
                        <StatusIcon status={req.status} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm font-bold bg-secondary px-2 py-0.5 rounded border">{req.code}</span>
                          <span className="font-semibold">{req.title}</span>
                        </div>
                        {req.controls && req.controls.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {req.controls.map(c => (
                              <span key={c.id} className="text-xs bg-muted border px-2 py-1 rounded font-medium flex items-center gap-1.5">
                                <Shield className="h-3 w-3" />
                                {c.title}
                                <TestResultBadge result={c.testResult} />
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-destructive mt-1 font-medium">No controls mapped to this requirement.</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {gapRequirements.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground">No gaps identified — all requirements are covered.</div>
                  )}
                </div>
              </Card>

              {remediations.length > 0 && (
                <Card className="shadow-sm border-t-4 border-t-foreground">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4" />
                      AI Remediation Plan
                      <Badge variant="outline" className="text-xs ml-auto">{remediations.length} recommendations</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {remediations.map((r, i) => (
                      <div key={i} className="border rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold text-sm">{r.gap}</div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", PRIORITY_BADGE[r.priority] || PRIORITY_BADGE.medium)}>
                              {r.priority}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                              <Clock className="h-3 w-3" />
                              {r.effortDays}d
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{r.steps}</p>
                        {r.suggestedControls.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {r.suggestedControls.map((ctrl, ci) => (
                              <span key={ci} className="text-xs bg-muted border px-2 py-0.5 rounded font-medium flex items-center gap-1">
                                <Shield className="h-3 w-3" />{ctrl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {assessingControl && (
        <InterviewDialog
          open={!!assessingControl}
          onOpenChange={(open) => { if (!open) setAssessingControl(null); }}
          type="control_assessment"
          title={assessingControl.title}
          controlId={assessingControl.id}
          onCommitted={() => setAssessingControl(null)}
        />
      )}
    </AppLayout>
  );
}
