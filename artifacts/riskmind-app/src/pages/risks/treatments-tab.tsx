import React, { useState } from "react";
import {
  useListTreatments,
  useCreateTreatment,
  useUpdateTreatment,
  useAiTreatmentRecommendations,
  useListTreatmentStatusEvents,
  useListAcceptanceMemorandum,
  useGenerateAcceptanceMemorandum,
  useApproveAcceptanceMemorandum,
  useRejectAcceptanceMemorandum,
  useGetMe,
} from "@workspace/api-client-react";
import type {
  Treatment,
  AiTreatmentRecommendation,
  TreatmentStrategy,
  TreatmentStatus,
  TreatmentStatusEvent,
  AcceptanceMemorandum,
} from "@workspace/api-client-react";
import { AiProvenance } from "@/components/ai/ai-provenance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  DollarSign,
  TrendingDown,
  Target,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  FileText,
  Eye,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const STRATEGY_LABELS: Record<string, string> = {
  treat: "Treat",
  transfer: "Transfer",
  tolerate: "Tolerate",
  terminate: "Terminate",
};

const STRATEGY_COLORS: Record<string, string> = {
  treat: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  transfer: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  tolerate: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  terminate: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  planned: { label: "Planned", icon: <Clock className="h-3 w-3" />, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  in_progress: { label: "In Progress", icon: <ArrowRight className="h-3 w-3" />, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  completed: { label: "Completed", icon: <CheckCircle2 className="h-3 w-3" />, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const MEMORANDUM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

interface TreatmentsTabProps {
  riskId: string;
  inherentScore: number;
  residualLikelihood?: number | null;
  residualImpact?: number | null;
}

export function TreatmentsTab({ riskId, inherentScore, residualLikelihood, residualImpact }: TreatmentsTabProps) {
  const queryClient = useQueryClient();
  const { data: treatments } = useListTreatments(riskId);
  const { data: currentUser } = useGetMe({ query: { queryKey: ["/api/v1/auth/me"] } });
  const { data: memorandaData } = useListAcceptanceMemorandum(riskId);
  const [aiOpen, setAiOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formStrategy, setFormStrategy] = useState<string>("treat");
  const [formDescription, setFormDescription] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formBenefit, setFormBenefit] = useState("");

  const [memorandumPreviewOpen, setMemorandumPreviewOpen] = useState(false);
  const [pendingMemorandum, setPendingMemorandum] = useState<AcceptanceMemorandum | null>(null);
  const [generateTreatmentId, setGenerateTreatmentId] = useState<string | null>(null);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectMemorandumId, setRejectMemorandumId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [recordsOpen, setRecordsOpen] = useState(false);
  const [viewMemorandum, setViewMemorandum] = useState<AcceptanceMemorandum | null>(null);

  const isApprover = currentUser?.role === "admin" || currentUser?.role === "risk_executive";

  const aiMutation = useAiTreatmentRecommendations({
    mutation: {
      onSuccess: () => setAiOpen(true),
    },
  });

  const createMutation = useCreateTreatment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${riskId}/treatments`] });
        setFormOpen(false);
        setFormDescription("");
        setFormCost("");
        setFormBenefit("");
        setFormStrategy("treat");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    },
  });

  const updateMutation = useUpdateTreatment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${riskId}/treatments`] });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    },
  });

  const generateMemorandumMutation = useGenerateAcceptanceMemorandum({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${riskId}/acceptance-memoranda`] });
        setPendingMemorandum(data as AcceptanceMemorandum);
        setMemorandumPreviewOpen(true);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    },
  });

  const approveMemorandumMutation = useApproveAcceptanceMemorandum({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${riskId}/acceptance-memoranda`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${riskId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
        setMemorandumPreviewOpen(false);
        setViewMemorandum(null);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    },
  });

  const rejectMemorandumMutation = useRejectAcceptanceMemorandum({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${riskId}/acceptance-memoranda`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${riskId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
        setRejectDialogOpen(false);
        setRejectionReason("");
        setRejectMemorandumId(null);
        setMemorandumPreviewOpen(false);
        setViewMemorandum(null);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    },
  });

  const handleStatusChange = (treatmentId: string, newStatus: string) => {
    updateMutation.mutate({
      riskId,
      id: treatmentId,
      data: { status: newStatus as TreatmentStatus },
    });
  };

  const handleCreateTreatment = () => {
    if (!formDescription.trim()) return;
    createMutation.mutate({
      riskId,
      data: {
        strategy: formStrategy as TreatmentStrategy,
        description: formDescription,
        cost: formCost || undefined,
        benefit: formBenefit || undefined,
      },
    });
  };

  const handleAcceptRecommendation = (rec: AiTreatmentRecommendation) => {
    setFormStrategy(rec.strategy || "treat");
    setFormDescription(rec.description || "");
    setFormCost(rec.estimatedCost ? String(rec.estimatedCost) : "");
    setFormBenefit(rec.expectedResidualScoreReduction ? String(rec.expectedResidualScoreReduction) : "");
    setFormOpen(true);
  };

  const handleGenerateMemorandum = (treatmentId: string) => {
    setGenerateTreatmentId(treatmentId);
    generateMemorandumMutation.mutate({
      riskId,
      data: { treatmentId },
    });
  };

  const handleApprove = (memorandumId: string) => {
    approveMemorandumMutation.mutate({ riskId, memorandumId });
  };

  const handleRejectConfirm = () => {
    if (!rejectMemorandumId || !rejectionReason.trim()) return;
    rejectMemorandumMutation.mutate({
      riskId,
      memorandumId: rejectMemorandumId,
      data: { rejectionReason: rejectionReason.trim() },
    });
  };

  const treatmentList = treatments?.data || [];
  const memoranda = memorandaData?.data || [];
  const pendingCount = memoranda.filter(m => m.status === "pending_approval").length;
  const totalCost = treatmentList.reduce((sum, t) => sum + (parseFloat(t.cost || "0") || 0), 0);
  const totalExpectedReduction = treatmentList.reduce((sum, t) => sum + (parseFloat(t.benefit || "0") || 0), 0);
  const actualResidualScore = (residualLikelihood && residualImpact)
    ? residualLikelihood * residualImpact
    : null;

  return (
    <div className="space-y-0">
      {treatmentList.length > 0 && (
        <div className="p-4 border-b bg-muted/10">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Cost-Benefit Summary</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <DollarSign className="h-5 w-5 text-amber-500" />
              <div>
                <div className="text-xs text-muted-foreground">Total Planned Cost</div>
                <div className="text-lg font-bold font-mono">
                  ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <TrendingDown className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-xs text-muted-foreground">Expected Score Reduction</div>
                <div className="text-lg font-bold font-mono">
                  {totalExpectedReduction > 0 ? `-${totalExpectedReduction}` : "0"} pts
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Overall ROI</div>
                <div className="text-lg font-bold font-mono">
                  {totalCost > 0 ? `${(totalExpectedReduction / totalCost * 100).toFixed(1)}%` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-b">
        <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors">
              {aiOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Sparkles className="h-4 w-4 text-primary" />
              AI Recommendations
            </CollapsibleTrigger>
            <Button
              variant="outline"
              size="sm"
              onClick={() => aiMutation.mutate({ id: riskId })}
              disabled={aiMutation.isPending}
            >
              {aiMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {aiMutation.data ? "Refresh" : "Get Recommendations"}
            </Button>
          </div>
          <CollapsibleContent className="mt-4">
            {aiMutation.isPending && (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analyzing risk and generating recommendations...
              </div>
            )}
            {aiMutation.isError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                Failed to generate recommendations. Ensure an AI provider is configured.
              </div>
            )}
            {aiMutation.data?.recommendations && aiMutation.data.recommendations.length > 0 && (
              <div className="grid gap-3">
                {aiMutation.data.recommendations.map((rec, idx) => (
                  <Card key={idx} className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">#{idx + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STRATEGY_COLORS[rec.strategy || "treat"]}`}>
                              {STRATEGY_LABELS[rec.strategy || "treat"]}
                            </span>
                            {rec.roi !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                ROI: {rec.roi.toFixed(1)}x
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground">{rec.description}</p>
                          <p className="text-xs text-muted-foreground italic">{rec.rationale}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {rec.estimatedCost !== undefined && (
                              <span>Cost: ${rec.estimatedCost.toLocaleString()}</span>
                            )}
                            {rec.expectedResidualScoreReduction !== undefined && (
                              <span>Score Reduction: -{rec.expectedResidualScoreReduction} pts</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAcceptRecommendation(rec)}
                          className="shrink-0"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add as Treatment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {aiMutation.data?.recommendations && aiMutation.data.recommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <AiProvenance action="Suggested by" className="justify-end" />
              </div>
            )}
            {aiMutation.isSuccess && (!aiMutation.data?.recommendations || aiMutation.data.recommendations.length === 0) && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No recommendations generated.
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {memoranda.length > 0 && (
        <div className="p-4 border-b">
          <Collapsible open={recordsOpen} onOpenChange={setRecordsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors w-full">
              {recordsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <FileText className="h-4 w-4 text-primary" />
              Acceptance Records
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">
                  {pendingCount} pending
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-2">
                {memoranda.map((m) => {
                  const statusConfig = MEMORANDUM_STATUS_CONFIG[m.status || "pending_approval"];
                  return (
                    <div key={m.id} className="p-3 border rounded-lg bg-background flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Requested by {m.requesterName || m.requesterEmail || "Unknown"}
                            {" · "}{m.createdAt ? format(new Date(m.createdAt), "MMM d, yyyy") : ""}
                          </span>
                        </div>
                        {m.status === "approved" && m.approverName && (
                          <div className="text-xs text-muted-foreground">
                            Approved by {m.approverName}{m.approvedAt ? ` on ${format(new Date(m.approvedAt), "MMM d, yyyy")}` : ""}
                          </div>
                        )}
                        {m.status === "rejected" && (
                          <div className="text-xs text-destructive italic space-y-0.5">
                            {m.rejectorName && (
                              <div>Rejected by {m.rejectorName}{m.rejectedAt ? ` on ${format(new Date(m.rejectedAt), "MMM d, yyyy")}` : ""}</div>
                            )}
                            {m.rejectionReason && <div>Reason: {m.rejectionReason}</div>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setViewMemorandum(m)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        {isApprover && m.status === "pending_approval" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => handleApprove(m.id!)}
                              disabled={approveMemorandumMutation.isPending}
                            >
                              {approveMemorandumMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3 mr-1" />}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => {
                                setRejectMemorandumId(m.id!);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      <div className="p-4 border-b flex justify-end">
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3 w-3 mr-1" />
              Add Treatment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Treatment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Strategy (4T)</Label>
                <Select value={formStrategy} onValueChange={setFormStrategy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treat">Treat</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="tolerate">Tolerate</SelectItem>
                    <SelectItem value="terminate">Terminate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the treatment plan..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estimated Cost ($)</Label>
                  <Input
                    type="number"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Score Reduction</Label>
                  <Input
                    type="number"
                    value={formBenefit}
                    onChange={(e) => setFormBenefit(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateTreatment}
                disabled={!formDescription.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Create Treatment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {treatmentList.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">No treatments defined.</div>
      ) : (
        <div className="divide-y">
          {treatmentList.map((t) => (
            <TreatmentCard
              key={t.id}
              riskId={riskId}
              treatment={t}
              inherentScore={inherentScore}
              actualResidualScore={actualResidualScore}
              onStatusChange={handleStatusChange}
              onGenerateMemorandum={handleGenerateMemorandum}
              isGenerating={generateMemorandumMutation.isPending && generateTreatmentId === t.id}
            />
          ))}
        </div>
      )}

      <Dialog open={memorandumPreviewOpen} onOpenChange={setMemorandumPreviewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Risk Acceptance Memorandum</DialogTitle>
            <DialogDescription>Review the AI-drafted memorandum before it is submitted for approval.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed p-4 bg-muted/30 rounded-lg border">
              {pendingMemorandum?.memorandumText}
            </pre>
          </div>
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-xs text-muted-foreground">
              Status: <span className="font-medium text-amber-700">Pending Approval</span>
            </div>
            <div className="flex gap-2">
              {isApprover && pendingMemorandum && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => handleApprove(pendingMemorandum.id!)}
                    disabled={approveMemorandumMutation.isPending}
                  >
                    {approveMemorandumMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/20 hover:bg-destructive/10"
                    onClick={() => {
                      setRejectMemorandumId(pendingMemorandum.id!);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setMemorandumPreviewOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewMemorandum} onOpenChange={(open) => { if (!open) setViewMemorandum(null); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Risk Acceptance Memorandum</DialogTitle>
            <DialogDescription>
              {viewMemorandum?.status && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${MEMORANDUM_STATUS_CONFIG[viewMemorandum.status]?.color}`}>
                  {MEMORANDUM_STATUS_CONFIG[viewMemorandum.status]?.label}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed p-4 bg-muted/30 rounded-lg border">
              {viewMemorandum?.memorandumText}
            </pre>
          </div>
          {viewMemorandum?.status === "rejected" && (
            <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-1">
              {(viewMemorandum.rejectorName || viewMemorandum.rejectedAt) && (
                <p className="text-xs text-destructive font-medium">
                  Rejected by {viewMemorandum.rejectorName || "Unknown"}
                  {viewMemorandum.rejectedAt
                    ? ` on ${format(new Date(viewMemorandum.rejectedAt), "MMM d, yyyy")}`
                    : ""}
                </p>
              )}
              {viewMemorandum.rejectionReason && (
                <>
                  <p className="text-xs text-destructive font-medium">Rejection Reason:</p>
                  <p className="text-xs text-destructive/80">{viewMemorandum.rejectionReason}</p>
                </>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-xs text-muted-foreground">
              {viewMemorandum?.requesterName || viewMemorandum?.requesterEmail
                ? `Requested by ${viewMemorandum.requesterName || viewMemorandum.requesterEmail}`
                : ""}
            </div>
            <div className="flex gap-2">
              {isApprover && viewMemorandum?.status === "pending_approval" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => handleApprove(viewMemorandum.id!)}
                    disabled={approveMemorandumMutation.isPending}
                  >
                    {approveMemorandumMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/20 hover:bg-destructive/10"
                    onClick={() => {
                      setRejectMemorandumId(viewMemorandum.id!);
                      setViewMemorandum(null);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setViewMemorandum(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectionReason(""); setRejectMemorandumId(null); } }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Reject Memorandum</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this memorandum. The risk will return to open status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this memorandum is being rejected..."
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => { setRejectDialogOpen(false); setRejectionReason(""); setRejectMemorandumId(null); }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim() || rejectMemorandumMutation.isPending}
              >
                {rejectMemorandumMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusTimeline({ riskId, treatmentId }: { riskId: string; treatmentId: string }) {
  const { data } = useListTreatmentStatusEvents(riskId, treatmentId);
  const events = data?.data;

  if (!events || events.length === 0) return null;

  return (
    <div className="mt-3 pl-2 border-l-2 border-muted space-y-2">
      {events.map((evt) => {
        const toConfig = STATUS_CONFIG[evt.toStatus || "planned"];
        const actorLabel = evt.changedByName || evt.changedByEmail || null;
        return (
          <div key={evt.id} className="flex items-start gap-2 pl-3 relative">
            <div className="absolute -left-[9px] top-1 h-3 w-3 rounded-full border-2 border-background bg-muted" />
            <div className="flex-1 text-[11px]">
              {actorLabel && (
                <span className="font-semibold text-foreground/80">{actorLabel}</span>
              )}
              <span className="text-muted-foreground">
                {actorLabel ? " " : ""}
                {evt.fromStatus ? (
                  <>
                    {"moved to "}
                    <span className="font-medium">{toConfig?.label || evt.toStatus}</span>
                    {" from "}
                    <span className="font-medium">{STATUS_CONFIG[evt.fromStatus]?.label || evt.fromStatus}</span>
                  </>
                ) : (
                  <>
                    {"created as "}
                    <span className="font-medium">{toConfig?.label || evt.toStatus}</span>
                  </>
                )}
              </span>
              <span className="ml-2 text-muted-foreground/70">
                {evt.createdAt ? format(new Date(evt.createdAt), "MMM d, yyyy HH:mm") : ""}
              </span>
              {evt.note && <span className="ml-2 italic text-muted-foreground">{evt.note}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TreatmentCard({
  riskId,
  treatment: t,
  inherentScore,
  actualResidualScore,
  onStatusChange,
  onGenerateMemorandum,
  isGenerating,
}: {
  riskId: string;
  treatment: Treatment;
  inherentScore: number;
  actualResidualScore: number | null;
  onStatusChange: (id: string, status: string) => void;
  onGenerateMemorandum: (treatmentId: string) => void;
  isGenerating: boolean;
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const statusConfig = STATUS_CONFIG[t.status || "planned"];
  const nextStates = STATUS_TRANSITIONS[t.status || "planned"] || [];
  const predictedReduction = parseFloat(t.benefit || "0") || 0;
  const isCompleted = t.status === "completed";
  const isTolerate = t.strategy === "tolerate";

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STRATEGY_COLORS[t.strategy || "treat"]}`}>
              {STRATEGY_LABELS[t.strategy || "treat"]}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.color}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
            <span className="font-semibold text-sm">{t.description}</span>
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground">
            {t.cost && <span>Cost: ${parseFloat(t.cost).toLocaleString()}</span>}
            {t.benefit && <span>Expected Reduction: -{t.benefit} pts</span>}
            {t.dueDate && <span>Due: {format(new Date(t.dueDate), "MMM d, yyyy")}</span>}
          </div>

          {t.progressNotes && (
            <p className="text-xs text-muted-foreground italic mt-1">{t.progressNotes}</p>
          )}

          {isCompleted && (
            <div className="mt-2 p-3 bg-muted/30 rounded-lg border">
              <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                <Target className="h-3 w-3" />
                Effectiveness
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Predicted Reduction:</span>
                  <span className="ml-1 font-mono font-bold">
                    {predictedReduction > 0 ? `-${predictedReduction}` : "0"} pts
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Actual Residual Score:</span>
                  <span className="ml-1 font-mono font-bold">
                    {actualResidualScore !== null ? `${actualResidualScore}/25` : "Not set"}
                  </span>
                  {actualResidualScore !== null && (
                    <span className="ml-1 text-muted-foreground">
                      (from {inherentScore}, delta: -{inherentScore - actualResidualScore})
                    </span>
                  )}
                </div>
              </div>
              {t.effectivenessScore !== null && t.effectivenessScore !== undefined && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Effectiveness Rating:</span>
                  <span className="ml-1 font-bold">{t.effectivenessScore}%</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setTimelineOpen(!timelineOpen)}
              className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors"
            >
              <Clock className="h-3 w-3" />
              {timelineOpen ? "Hide" : "Show"} History
            </button>
            <span className="text-[10px] text-muted-foreground">
              Created {t.createdAt ? format(new Date(t.createdAt), "MMM d, yyyy") : ""}
            </span>
          </div>

          {timelineOpen && t.id && <StatusTimeline riskId={riskId} treatmentId={t.id} />}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {isTolerate && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 text-amber-700 border-amber-200 hover:bg-amber-50"
              onClick={() => onGenerateMemorandum(t.id!)}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
              Acceptance Memo
            </Button>
          )}
          {nextStates.map((ns) => {
            const nsConfig = STATUS_CONFIG[ns];
            return (
              <Button
                key={ns}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onStatusChange(t.id!, ns)}
              >
                {nsConfig.icon}
                <span className="ml-1">{nsConfig.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
