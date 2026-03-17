import { useState, useEffect, useCallback } from "react";
import {
  useListSignals,
  useUpdateSignalStatus,
  usePromoteSignalToFinding,
  useTriageSignal,
  useSuggestRiskFromFinding,
  useConvertFindingToRisk,
  useGetSignalFinding,
} from "@workspace/api-client-react";
import type { RiskSuggestion, RiskCategory } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Activity, Search, Bot, ArrowRight, Check, X, Loader2, Sparkles, Eye, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

function statusBadge(status: string) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    triaged: { label: "Triaged", className: "bg-blue-100 text-blue-800 border-blue-200" },
    finding: { label: "Finding", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    dismissed: { label: "Dismissed", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const c = config[status] || config.pending;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function FindingPanel({
  signalId,
  open,
  onClose,
}: {
  signalId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [suggestion, setSuggestion] = useState<RiskSuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    setSuggestion(null);
    setLoadingSuggestion(false);
    setConverting(false);
  }, [signalId]);

  const { data: finding, isLoading: findingLoading } = useGetSignalFinding(
    signalId || "",
    { query: { queryKey: ["/api/v1/signals", signalId, "finding"] as const, enabled: !!signalId && open } }
  );

  const suggestMutation = useSuggestRiskFromFinding();
  const convertMutation = useConvertFindingToRisk();

  const handleSuggestRisk = async () => {
    if (!finding?.id) return;
    setLoadingSuggestion(true);
    try {
      const result = await suggestMutation.mutateAsync({ id: finding.id });
      setSuggestion(result);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleConvertToRisk = () => {
    if (!finding?.id) return;
    setConverting(true);
    const data = suggestion
      ? {
          title: suggestion.title || finding.title || "",
          description: suggestion.description || finding.description || "",
          category: (suggestion.category || "operational") as RiskCategory,
          likelihood: suggestion.likelihood || 3,
          impact: suggestion.impact || 3,
        }
      : {
          title: finding.title || "",
          description: finding.description || "",
        };

    convertMutation.mutate(
      { id: finding.id, data },
      {
        onSuccess: (risk: { id?: string }) => {
          queryClient.invalidateQueries({ queryKey: ["/api/v1/signals"] });
          queryClient.invalidateQueries({ queryKey: ["/api/v1/findings"] });
          queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
          onClose();
          if (risk?.id) setLocation(`/risks/${risk.id}`);
        },
        onSettled: () => setConverting(false),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Finding Details</SheetTitle>
          <SheetDescription>
            View the finding linked to this signal and manage risk conversion.
          </SheetDescription>
        </SheetHeader>

        {findingLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !finding ? (
          <div className="py-8 text-center text-muted-foreground">
            No finding linked to this signal.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Title</h3>
              <p className="mt-1 text-sm">{finding.title}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Description</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap">{finding.description || "—"}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status</h3>
                <Badge variant="outline" className="mt-1">{finding.status}</Badge>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Created</h3>
                <p className="mt-1 text-sm">{finding.createdAt ? format(new Date(finding.createdAt), "MMM d, HH:mm") : "—"}</p>
              </div>
            </div>

            {finding.riskId ? (
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  This finding is already linked to a risk.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => { onClose(); setLocation(`/risks/${finding.riskId}`); }}
                >
                  View Risk
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    AI Risk Suggestion
                  </h3>

                  {!suggestion ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 text-violet-600 border-violet-200 hover:bg-violet-50"
                      onClick={handleSuggestRisk}
                      disabled={loadingSuggestion}
                    >
                      {loadingSuggestion ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-2" />
                      )}
                      Get AI Suggestion
                    </Button>
                  ) : (
                    <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground">Suggested Title</span>
                        <p className="text-sm font-medium">{suggestion.title}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground">Description</span>
                        <p className="text-sm">{suggestion.description}</p>
                      </div>
                      <div className="flex gap-4 flex-wrap">
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">Category</span>
                          <p className="text-sm capitalize">{suggestion.category}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">Likelihood</span>
                          <p className="text-sm">{suggestion.likelihood}/5</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">Impact</span>
                          <p className="text-sm">{suggestion.impact}/5</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">Confidence</span>
                          <p className="text-sm">{Math.round((suggestion.confidence || 0) * 100)}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3 w-3" />
                        Source: {suggestion.source === "ai" ? "AI-generated" : "Fallback (no LLM configured)"}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleConvertToRisk}
                  disabled={converting}
                >
                  {converting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Create Risk from Finding
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SignalList() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "triaged" | "finding">("pending");
  const queryClient = useQueryClient();
  const [retriggering, setRetriggering] = useState<Record<string, boolean>>({});
  const [findingPanelSignalId, setFindingPanelSignalId] = useState<string | null>(null);

  const handleRetriggerTriage = async (signalId: string) => {
    setRetriggering((prev) => ({ ...prev, [signalId]: true }));
    try {
      const token = localStorage.getItem("accessToken");
      await fetch(`/api/v1/signals/${signalId}/retrigger-triage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } finally {
      setRetriggering((prev) => ({ ...prev, [signalId]: false }));
    }
  };

  const { data: pendingData, isLoading: pendingLoading } = useListSignals(
    { status: "pending", search: search || undefined },
    { query: { queryKey: ["/api/v1/signals", "pending", search] } }
  );
  const { data: triagedData, isLoading: triagedLoading } = useListSignals(
    { status: "triaged", search: search || undefined },
    { query: { queryKey: ["/api/v1/signals", "triaged", search] } }
  );
  const { data: findingData, isLoading: findingLoading } = useListSignals(
    { status: "finding", search: search || undefined },
    { query: { queryKey: ["/api/v1/signals", "finding", search] } }
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/v1/signals"] });
  };

  const triageMutation = useUpdateSignalStatus({
    mutation: { onSuccess: invalidate },
  });

  const promoteMutation = usePromoteSignalToFinding({
    mutation: { onSuccess: invalidate },
  });

  const triageFullMutation = useTriageSignal({
    mutation: { onSuccess: invalidate },
  });

  const handleMarkTriaged = (id: string) => {
    triageMutation.mutate({ id, data: { status: "triaged" } });
  };

  const handleFullTriage = (id: string) => {
    triageFullMutation.mutate({ id });
  };

  const handlePromote = (signalId: string, content?: string) => {
    promoteMutation.mutate({
      signalId,
      data: { title: content?.slice(0, 100) || "Signal finding" },
    });
  };

  const handleDismiss = (id: string) => {
    triageMutation.mutate({ id, data: { status: "dismissed" } });
  };

  const data =
    tab === "pending"
      ? pendingData
      : tab === "triaged"
        ? triagedData
        : findingData;
  const isLoading =
    tab === "pending"
      ? pendingLoading
      : tab === "triaged"
        ? triagedLoading
        : findingLoading;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Signal Feed</h1>
          <p className="text-muted-foreground mt-1">Continuous ingestion of external data points requiring triage.</p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-t-4 border-t-primary">
          <div className="p-4 border-b bg-card flex items-center gap-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "triaged" | "finding")} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="pending" className="text-xs px-3 h-7">
                  Pending ({pendingData?.data?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="triaged" className="text-xs px-3 h-7">
                  Triaged ({triagedData?.data?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="finding" className="text-xs px-3 h-7">
                  Findings ({findingData?.data?.length || 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search signal content..."
                className="pl-9 bg-muted/50"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground font-mono ml-auto flex items-center">
              <Activity className="h-4 w-4 mr-2 text-primary animate-pulse" />
              Live Feed Active
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[120px]">Source</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[180px]">AI Classification</TableHead>
                  <TableHead className="w-[150px]">Received</TableHead>
                  <TableHead className="text-right w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></TableCell>
                  </TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No {tab === "finding" ? "finding" : tab} signals.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((signal) => (
                    <TableRow key={signal.id} className="group hover:bg-muted/30">
                      <TableCell className="font-mono text-xs uppercase text-muted-foreground">{signal.source}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[400px] truncate" title={signal.content}>{signal.content}</TableCell>
                      <TableCell>{statusBadge(signal.status || "pending")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary flex w-fit items-center gap-1.5">
                          <Bot className="h-3 w-3" />
                          <span className="capitalize">{signal.classification?.replace('_', ' ') || 'Unknown'}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(signal.createdAt || ''), 'MMM d, HH:mm')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          {tab === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                                disabled={retriggering[signal.id!] || false}
                                onClick={() => signal.id && handleRetriggerTriage(signal.id)}
                                title="Re-queue AI triage for this signal"
                              >
                                {retriggering[signal.id!]
                                  ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  : <Sparkles className="h-3 w-3 mr-1" />
                                }
                                Retrigger AI
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={triageMutation.isPending}
                                onClick={() => signal.id && handleMarkTriaged(signal.id)}
                              >
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Triage
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                disabled={triageFullMutation.isPending}
                                onClick={() => signal.id && handleFullTriage(signal.id)}
                                title="Triage and create finding in one step"
                              >
                                {triageFullMutation.isPending
                                  ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  : <Sparkles className="h-3 w-3 mr-1" />
                                }
                                Auto-Triage
                              </Button>
                            </>
                          ) : tab === "triaged" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => signal.id && setFindingPanelSignalId(signal.id)}
                                title="View linked finding (if exists)"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Finding
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                                disabled={promoteMutation.isPending}
                                onClick={() => signal.id && handlePromote(signal.id, signal.content)}
                                title="Promote to finding"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={triageMutation.isPending}
                                onClick={() => signal.id && handleDismiss(signal.id)}
                                title="Dismiss signal"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => signal.id && setFindingPanelSignalId(signal.id)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Finding
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <FindingPanel
        signalId={findingPanelSignalId}
        open={!!findingPanelSignalId}
        onClose={() => setFindingPanelSignalId(null)}
      />
    </AppLayout>
  );
}
