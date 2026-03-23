import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetVendor,
  useListQuestionnaires,
  useListDocuments,
  useCalculateVendorRiskScore,
  useTransitionVendor,
  useCreateDocument,
  useSummarizeVendorDocument,
  useCreateQuestionnaire,
  useGenerateAiQuestions,
  useValidateQuestionnaireAnswers,
  useScoreQuestionnaire,
  useUpdateQuestionnaireResponses,
} from "@workspace/api-client-react";
import type { VendorStatus, VendorTier, Questionnaire, QuestionnaireScoreResponse, ValidationFlagsResponse } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/severity-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import {
  ArrowLeft,
  Building2,
  Mail,
  Loader2,
  FileText,
  ClipboardList,
  RefreshCw,
  Upload,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Check,
  Plus,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const FULL_FLOW: VendorStatus[] = [
  "identification",
  "due_diligence",
  "risk_assessment",
  "contracting",
  "onboarding",
  "monitoring",
  "offboarding",
];

const SIMPLIFIED_FLOW: VendorStatus[] = [
  "identification",
  "risk_assessment",
  "monitoring",
  "offboarding",
];

function getLifecycleFlow(tier?: VendorTier | null): VendorStatus[] {
  if (tier === "critical" || tier === "high") return FULL_FLOW;
  return SIMPLIFIED_FLOW;
}

function getNextStatus(tier: VendorTier | undefined | null, currentStatus: VendorStatus): VendorStatus | null {
  const flow = getLifecycleFlow(tier);
  const idx = flow.indexOf(currentStatus);
  if (idx === -1 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

const STATUS_LABELS: Record<string, string> = {
  identification: "Identification",
  due_diligence: "Due Diligence",
  risk_assessment: "Risk Assessment",
  contracting: "Contracting",
  onboarding: "Onboarding",
  monitoring: "Monitoring",
  offboarding: "Offboarding",
};

function LifecycleStepper({ currentStatus, tier }: { currentStatus?: VendorStatus; tier?: VendorTier | null }) {
  const flow = getLifecycleFlow(tier);
  const currentIndex = currentStatus ? flow.indexOf(currentStatus) : -1;

  return (
    <div className="flex items-center w-full gap-1">
      {flow.map((status, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;

        return (
          <div key={status} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 transition-all",
                  isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                  isCurrent && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                  isFuture && "bg-muted border-border text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1.5 text-center font-medium leading-tight truncate w-full",
                  isCompleted && "text-emerald-600 dark:text-emerald-400",
                  isCurrent && "text-primary font-semibold",
                  isFuture && "text-muted-foreground"
                )}
              >
                {STATUS_LABELS[status] || status}
              </span>
            </div>
            {index < flow.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 min-w-4 mt-[-16px]",
                  index < currentIndex ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getTierColor(tier: string) {
  switch (tier) {
    case "critical": return "text-red-600 bg-red-50 border-red-200";
    case "high": return "text-orange-600 bg-orange-50 border-orange-200";
    case "medium": return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "low": return "text-green-600 bg-green-50 border-green-200";
    default: return "text-muted-foreground bg-muted border-border";
  }
}

function QuestionnaireDetail({
  questionnaire,
  vendorId,
}: {
  questionnaire: Questionnaire;
  vendorId: string;
}) {
  const queryClient = useQueryClient();
  const [localResponses, setLocalResponses] = useState<Record<string, any>>(() => {
    const resp = questionnaire.responses as Record<string, any> | null;
    return resp || {};
  });
  const [scoreResult, setScoreResult] = useState<QuestionnaireScoreResponse | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationFlagsResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${vendorId}/questionnaires`] });
    queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${vendorId}`] });
  };

  const aiQuestionsMutation = useGenerateAiQuestions({
    mutation: { onSuccess: () => invalidateAll() },
  });

  const validateMutation = useValidateQuestionnaireAnswers({
    mutation: {
      onSuccess: (data) => {
        setValidationResult(data as ValidationFlagsResponse);
      },
    },
  });

  const scoreMutation = useScoreQuestionnaire({
    mutation: {
      onSuccess: (data) => {
        setScoreResult(data as QuestionnaireScoreResponse);
        invalidateAll();
      },
    },
  });

  const updateResponsesMutation = useUpdateQuestionnaireResponses({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setSaving(false);
      },
    },
  });

  const template = (questionnaire.template as unknown as any[]) || [];
  const qId = questionnaire.id || "";

  const handleSaveResponses = () => {
    setSaving(true);
    updateResponsesMutation.mutate({ vendorId, qId, data: { responses: localResponses } });
  };

  const handleResponseChange = (questionId: string, value: any) => {
    setLocalResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const answeredCount = Object.keys(localResponses).filter((k) => {
    const v = localResponses[k];
    return v !== undefined && v !== null && v !== "";
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{questionnaire.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={questionnaire.status} />
            <span className="text-xs text-muted-foreground">
              {answeredCount}/{template.length} answered
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveResponses}
            disabled={saving || updateResponsesMutation.isPending}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Save Responses
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => aiQuestionsMutation.mutate({ vendorId, qId })}
            disabled={aiQuestionsMutation.isPending}
          >
            {aiQuestionsMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            AI Questions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => validateMutation.mutate({ vendorId, qId })}
            disabled={validateMutation.isPending || answeredCount === 0}
          >
            {validateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <ShieldAlert className="h-3 w-3 mr-1" />
            )}
            Validate
          </Button>
          <Button
            size="sm"
            onClick={() => scoreMutation.mutate({ vendorId, qId })}
            disabled={scoreMutation.isPending}
          >
            {scoreMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <BarChart3 className="h-3 w-3 mr-1" />
            )}
            Score
          </Button>
        </div>
      </div>

      {scoreResult && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">Scoring Result</h4>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono">{scoreResult.riskScore}</span>
                <span className="text-xs text-muted-foreground">/100</span>
                {scoreResult.tier && (
                  <Badge className={`${getTierColor(scoreResult.tier)} text-xs capitalize`}>
                    {scoreResult.tier}
                  </Badge>
                )}
              </div>
            </div>
            <Progress value={scoreResult.riskScore} className="h-2" />
            <div className="text-xs text-muted-foreground mt-2">
              {scoreResult.answeredQuestions}/{scoreResult.totalQuestions} questions answered
            </div>
          </CardContent>
        </Card>
      )}

      {validationResult && validationResult.flags && validationResult.flags.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-1 text-orange-700">
              <AlertTriangle className="h-4 w-4" />
              Validation Flags ({validationResult.flags.length})
            </h4>
            <div className="space-y-2">
              {validationResult.flags.map((flag, idx) => (
                <div key={idx} className="p-2 bg-white rounded border border-orange-200 text-sm">
                  <div className="font-medium text-orange-800">{flag.flagReason}</div>
                  <div className="text-xs text-orange-600 mt-1">
                    Confidence: {Math.round((flag.confidence || 0) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {validationResult && validationResult.flags && validationResult.flags.length === 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">All responses validated - no discrepancies found.</span>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {template.map((q: any, idx: number) => (
          <Card key={q.questionId || idx} className={`${q.isAiGenerated ? "border-purple-200 bg-purple-50/20" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 mt-0.5 shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{q.text}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {q.isAiGenerated && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-purple-300 text-purple-600">
                          AI
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">
                        {q.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">w:{q.weight}</span>
                    </div>
                  </div>

                  {q.answerType === "boolean" && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={localResponses[q.questionId] === true || localResponses[q.questionId] === "true"}
                        onCheckedChange={(checked) => handleResponseChange(q.questionId, checked)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {localResponses[q.questionId] === true || localResponses[q.questionId] === "true" ? "Yes" : "No"}
                      </span>
                    </div>
                  )}

                  {q.answerType === "scale" && (
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={1}
                        className="w-20 h-8 text-sm"
                        placeholder="0-10"
                        value={localResponses[q.questionId] ?? ""}
                        onChange={(e) => handleResponseChange(q.questionId, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">Scale: 0 (worst) - 10 (best)</span>
                    </div>
                  )}

                  {q.answerType === "text" && (
                    <Textarea
                      className="text-sm min-h-[60px]"
                      placeholder="Enter your response..."
                      value={localResponses[q.questionId] ?? ""}
                      onChange={(e) => handleResponseChange(q.questionId, e.target.value)}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}

interface Subprocessor {
  id: string;
  vendorId: string;
  subprocessorId: string;
  subprocessorName: string;
  relationshipType: string;
  criticality: string;
  discoveredBy: string;
  createdAt: string;
}

export default function VendorDetail() {
  const [, params] = useRoute("/vendors/:id");
  const id = params?.id || "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docForm, setDocForm] = useState({ fileName: "", mimeType: "application/pdf" });
  const [summarizingDocs, setSummarizingDocs] = useState<Record<string, "pending" | "done">>({});
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [newQuestionnaireTitle, setNewQuestionnaireTitle] = useState("");
  const [creatingQ, setCreatingQ] = useState(false);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  // Subprocessors state
  const [subOpen, setSubOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addMode, setAddMode] = useState<"link" | "create">("link");
  const [subLinkSearch, setSubLinkSearch] = useState("");
  const [subLinkVendorId, setSubLinkVendorId] = useState("");
  const [subLinkRelType, setSubLinkRelType] = useState("");
  const [subLinkCriticality, setSubLinkCriticality] = useState("");
  const [subCreateName, setSubCreateName] = useState("");
  const [subCreateRelType, setSubCreateRelType] = useState("");
  const [subCreateCriticality, setSubCreateCriticality] = useState("");
  const [subSubmitting, setSubSubmitting] = useState(false);

  const { data: vendor, isLoading } = useGetVendor(id);
  const { data: questionnaires } = useListQuestionnaires(id);
  const { data: documents } = useListDocuments(id);

  const { data: subprocessors, refetch: refetchSubs } = useQuery<Subprocessor[]>({
    queryKey: ["/api/v1/vendors", id, "subprocessors"],
    queryFn: () => fetch(`/api/v1/vendors/${id}/subprocessors`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id,
  });

  const { data: vendorSearchResults } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/v1/vendors", "search", subLinkSearch],
    queryFn: () => fetch(`/api/v1/vendors${subLinkSearch ? `?search=${encodeURIComponent(subLinkSearch)}` : "?limit=20"}`, { credentials: "include" }).then(r => r.json()),
    enabled: addMode === "link" && addSubOpen,
  });

  // Auto-open subprocessors section when data has items
  useEffect(() => {
    if (subprocessors && subprocessors.length > 0) {
      setSubOpen(true);
    }
  }, [subprocessors]);

  const calcMutation = useCalculateVendorRiskScore({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}`] })
    }
  });

  const transitionMutation = useTransitionVendor({
    mutation: {
      onSuccess: () => {
        setTransitionError(null);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}`] });
      },
      onError: (error: unknown) => {
        const err = error as { detail?: string; message?: string } | undefined;
        const detail = err?.detail || err?.message || "Transition failed";
        setTransitionError(detail);
      },
    }
  });

  const uploadMutation = useCreateDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}/documents`] });
        setUploadOpen(false);
        setDocForm({ fileName: "", mimeType: "application/pdf" });
      }
    }
  });

  const summarizeMutation = useSummarizeVendorDocument({
    mutation: {
      onSuccess: (_, vars) => {
        setSummarizingDocs((prev) => ({ ...prev, [vars.documentId]: "done" }));
      },
    },
  });

  const createQuestionnaireMutation = useCreateQuestionnaire({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}/questionnaires`] });
        setNewQuestionnaireTitle("");
        setCreatingQ(false);
        if (data?.id) setExpandedQ(data.id);
      },
    },
  });

  if (isLoading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div></AppLayout>;
  if (!vendor) return <AppLayout><div className="p-8 text-center text-muted-foreground">Vendor not found</div></AppLayout>;

  const effectiveTier = (vendor.overrideTier || vendor.tier) as VendorTier | undefined;
  const nextStatus = getNextStatus(effectiveTier, vendor.status as VendorStatus);

  const handleAddSubprocessor = async () => {
    setSubSubmitting(true);
    try {
      const body = addMode === "link"
        ? { subprocessorId: subLinkVendorId, relationshipType: subLinkRelType, criticality: subLinkCriticality, discoveredBy: "manual" }
        : { name: subCreateName, relationshipType: subCreateRelType, criticality: subCreateCriticality, discoveredBy: "manual" };

      const res = await fetch(`/api/v1/vendors/${id}/subprocessors`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        toast({ title: "This vendor is already linked as a subprocessor.", variant: "destructive" });
        return;
      }
      if (!res.ok) {
        toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
        return;
      }

      toast({ title: addMode === "link" ? "Subprocessor linked." : "Subprocessor added." });
      setAddSubOpen(false);
      setSubLinkVendorId("");
      setSubLinkRelType("");
      setSubLinkCriticality("");
      setSubLinkSearch("");
      setSubCreateName("");
      setSubCreateRelType("");
      setSubCreateCriticality("");
      refetchSubs();
    } finally {
      setSubSubmitting(false);
    }
  };

  const handleDeleteSubprocessor = async (subId: string) => {
    const res = await fetch(`/api/v1/vendors/${id}/subprocessors/${subId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok || res.status === 204) {
      toast({ title: "Subprocessor removed." });
      refetchSubs();
    } else {
      toast({ title: "Failed to remove subprocessor.", variant: "destructive" });
    }
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case "critical": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
      case "high": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "low": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const riskScoreNum = vendor.riskScore ? parseFloat(String(vendor.riskScore)) : null;
  let riskTier = "";
  if (riskScoreNum !== null) {
    if (riskScoreNum >= 75) riskTier = "critical";
    else if (riskScoreNum >= 50) riskTier = "high";
    else if (riskScoreNum >= 25) riskTier = "medium";
    else riskTier = "low";
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/vendors">Vendors</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{vendor?.name ?? "Vendor Detail"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center space-x-4 mb-4">
          <Link href="/vendors">
            <Button variant="outline" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="font-mono text-sm text-muted-foreground">VND-{vendor.id?.split('-')[0].toUpperCase()}</div>
        </div>

        <Card className="shadow-sm border-t-4 border-t-sidebar p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lifecycle Progress</h3>
            <StatusBadge status={vendor.status} />
          </div>
          <LifecycleStepper currentStatus={vendor.status as VendorStatus} tier={effectiveTier} />
          {nextStatus && (
            <div className="mt-4 flex items-center gap-3 pt-4 border-t">
              <Button
                size="sm"
                disabled={transitionMutation.isPending}
                onClick={() => {
                  setTransitionError(null);
                  transitionMutation.mutate({ id, data: { targetStatus: nextStatus } });
                }}
              >
                {transitionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                Advance to {STATUS_LABELS[nextStatus] || nextStatus}
              </Button>
            </div>
          )}
          {transitionError && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{transitionError}</span>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm">
            <CardContent className="p-8 flex flex-col md:flex-row gap-6 items-start">
              <div className="h-24 w-24 rounded-xl bg-secondary flex items-center justify-center shrink-0 border-2 border-border shadow-sm">
                <Building2 className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold tracking-tight">{vendor.name}</h1>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /> {vendor.contactEmail || "No contact email"}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 bg-muted/30 p-4 rounded-lg border">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Category</span>
                    <div className="font-medium mt-1">{vendor.category || "Uncategorized"}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Criticality Tier</span>
                    <div className="font-medium mt-1 capitalize">
                      {vendor.tier}
                      {vendor.overrideTier && (
                        <span className="text-xs text-muted-foreground ml-2">(overridden)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="flex items-center justify-between">
                Risk Score
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => calcMutation.mutate({ id })}
                  disabled={calcMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${calcMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-8">
              {riskScoreNum !== null ? (
                <>
                  <div className="text-6xl font-bold font-mono tracking-tighter">{riskScoreNum}</div>
                  <span className="text-sm text-muted-foreground mt-2">/ 100</span>
                  {riskTier && (
                    <Badge className={`${getTierColor(riskTier)} mt-2 capitalize`}>{riskTier} risk</Badge>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <span className="text-2xl font-bold block mb-2">-</span>
                  <span className="text-xs">Awaiting data to calculate</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="questionnaires" className="w-full mt-8">
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger value="questionnaires" className="data-[state=active]:shadow-sm rounded-md"><ClipboardList className="h-4 w-4 mr-2" /> Questionnaires</TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:shadow-sm rounded-md"><FileText className="h-4 w-4 mr-2" /> Documents</TabsTrigger>
          </TabsList>
          
          <div className="mt-6 bg-card border rounded-xl overflow-hidden shadow-sm min-h-[300px]">
            <TabsContent value="questionnaires" className="p-0 m-0 border-none outline-none">
              <div className="p-4 border-b bg-muted/10 flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  {questionnaires?.data?.length || 0} questionnaire(s)
                </span>
                {!creatingQ ? (
                  <Button variant="outline" size="sm" onClick={() => setCreatingQ(true)}>
                    <Plus className="h-4 w-4 mr-2" /> New Questionnaire
                  </Button>
                ) : (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newQuestionnaireTitle.trim()) return;
                      createQuestionnaireMutation.mutate({
                        vendorId: id,
                        data: { title: newQuestionnaireTitle.trim() },
                      });
                    }}
                  >
                    <Input
                      className="h-8 w-64"
                      placeholder="Questionnaire title..."
                      value={newQuestionnaireTitle}
                      onChange={(e) => setNewQuestionnaireTitle(e.target.value)}
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createQuestionnaireMutation.isPending || !newQuestionnaireTitle.trim()}
                    >
                      {createQuestionnaireMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setCreatingQ(false); setNewQuestionnaireTitle(""); }}
                    >
                      Cancel
                    </Button>
                  </form>
                )}
              </div>

              {questionnaires?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p>No assessments sent to this vendor.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setCreatingQ(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Send Assessment
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {questionnaires?.data?.map((q) => (
                    <div key={q.id}>
                      <div
                        className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center cursor-pointer"
                        onClick={() => setExpandedQ(expandedQ === q.id ? null : (q.id || null))}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            {expandedQ === q.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm mb-1">{q.title}</div>
                            <span className="text-xs text-muted-foreground font-mono">
                              {(q.template as unknown as any[])?.length || 0} questions
                              {" · "}
                              Last updated: {format(new Date(q.updatedAt || ''), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={q.status} />
                      </div>
                      {expandedQ === q.id && (
                        <div className="px-4 pb-4 border-t bg-muted/5">
                          <div className="pt-4">
                            <QuestionnaireDetail questionnaire={q} vendorId={id} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="documents" className="p-0 m-0 border-none outline-none">
              <div className="p-4 border-b bg-muted/10 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Upload Document
                </Button>
              </div>
              {documents?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p>No documents uploaded (SOC2, ISO27001, etc).</p>
                </div>
              ) : (
                <div className="divide-y">
                  {documents?.data?.map(doc => (
                    <div key={doc.id} className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded border"><FileText className="h-4 w-4" /></div>
                        <div>
                          <div className="font-semibold text-sm mb-1">{doc.fileName}</div>
                          <span className="text-xs text-muted-foreground">Type: {doc.mimeType?.split('/')[1] || 'unknown'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {summarizingDocs[doc.id!] === "done" ? (
                          <span className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Analysis queued
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={summarizeMutation.isPending || summarizingDocs[doc.id!] === "pending"}
                            onClick={() => {
                              if (!doc.id) return;
                              setSummarizingDocs((prev) => ({ ...prev, [doc.id!]: "pending" }));
                              summarizeMutation.mutate({ vendorId: id, documentId: doc.id });
                            }}
                          >
                            {summarizingDocs[doc.id!] === "pending" ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            AI Analysis
                          </Button>
                        )}
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Subprocessors collapsible section */}
        <Collapsible open={subOpen} onOpenChange={setSubOpen} className="mt-8 border rounded-lg">
          <CollapsibleTrigger asChild>
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg"
              aria-expanded={subOpen}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Subprocessors</h3>
                {subprocessors && subprocessors.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{subprocessors.length}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setAddSubOpen(true); }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Subprocessor
                </Button>
                {subOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {subprocessors && subprocessors.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Relationship Type</TableHead>
                    <TableHead>Criticality</TableHead>
                    <TableHead>Discovered By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subprocessors.map(sub => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        <a href={`/vendors/${sub.subprocessorId}`} className="hover:underline text-primary">
                          {sub.subprocessorName}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">{sub.relationshipType || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] capitalize font-medium", getCriticalityColor(sub.criticality))}>
                          {sub.criticality}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.discoveredBy === "llm" ? (
                          <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20">
                            AI
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteSubprocessor(sub.id)}
                          aria-label={`Remove ${sub.subprocessorName} as subprocessor`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Building2 className="h-8 w-8 text-muted-foreground/30" />
                <p className="font-medium text-sm">No Subprocessors</p>
                <p className="text-xs">Track fourth-party vendors that this vendor relies on.</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Add Subprocessor Sheet */}
      <Sheet open={addSubOpen} onOpenChange={setAddSubOpen}>
        <SheetContent className="sm:max-w-md w-full border-l">
          <SheetHeader>
            <SheetTitle>Add Subprocessor</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <div className="flex gap-2 mb-6 border-b pb-4">
              <Button
                variant={addMode === "link" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("link")}
              >
                Link Existing
              </Button>
              <Button
                variant={addMode === "create" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("create")}
              >
                Create New
              </Button>
            </div>

            {addMode === "link" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Vendor</Label>
                  <Input
                    placeholder="Search by name..."
                    value={subLinkSearch}
                    onChange={e => setSubLinkSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Select Vendor</Label>
                  <Select value={subLinkVendorId} onValueChange={setSubLinkVendorId}>
                    <SelectTrigger><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                    <SelectContent>
                      {vendorSearchResults?.data?.filter(v => v.id !== id).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Relationship Type</Label>
                  <Input
                    placeholder="e.g. Cloud Infrastructure, Payment Processing..."
                    value={subLinkRelType}
                    onChange={e => setSubLinkRelType(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Criticality</Label>
                  <Select value={subLinkCriticality} onValueChange={setSubLinkCriticality}>
                    <SelectTrigger><SelectValue placeholder="Select criticality..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!subLinkVendorId || subSubmitting}
                  onClick={handleAddSubprocessor}
                >
                  {subSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Link Subprocessor
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input
                    placeholder="e.g. Amazon Web Services"
                    value={subCreateName}
                    onChange={e => setSubCreateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Relationship Type</Label>
                  <Input
                    placeholder="e.g. Cloud Infrastructure, Payment Processing..."
                    value={subCreateRelType}
                    onChange={e => setSubCreateRelType(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Criticality</Label>
                  <Select value={subCreateCriticality} onValueChange={setSubCreateCriticality}>
                    <SelectTrigger><SelectValue placeholder="Select criticality..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!subCreateName || subSubmitting}
                  onClick={handleAddSubprocessor}
                >
                  {subSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Subprocessor
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent className="sm:max-w-md w-full border-l">
          <SheetHeader>
            <SheetTitle>Upload Document</SheetTitle>
            <SheetDescription>Add a compliance document for this vendor (SOC2, ISO 27001, etc).</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); uploadMutation.mutate({ vendorId: id, data: { fileName: docForm.fileName, mimeType: docForm.mimeType } }); }} className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input required value={docForm.fileName} onChange={e => setDocForm({...docForm, fileName: e.target.value})} placeholder="SOC2_Type_II_2025.pdf" />
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={docForm.mimeType} onValueChange={(v) => setDocForm({...docForm, mimeType: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="application/pdf">PDF</SelectItem>
                  <SelectItem value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">DOCX</SelectItem>
                  <SelectItem value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">XLSX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
