import { useState } from "react";
import { useListSignals, useUpdateSignalStatus, usePromoteSignalToFinding } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Search, Bot, ArrowRight, Check, X, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function SignalList() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "triaged">("pending");
  const queryClient = useQueryClient();
  const [retriggering, setRetriggering] = useState<Record<string, boolean>>({});

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/v1/signals"] });
  };

  const triageMutation = useUpdateSignalStatus({
    mutation: { onSuccess: invalidate },
  });

  const promoteMutation = usePromoteSignalToFinding({
    mutation: { onSuccess: invalidate },
  });

  const handleMarkTriaged = (id: string) => {
    triageMutation.mutate({ id, data: { status: "triaged" } });
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

  const data = tab === "pending" ? pendingData : triagedData;
  const isLoading = tab === "pending" ? pendingLoading : triagedLoading;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Signal Feed</h1>
          <p className="text-muted-foreground mt-1">Continuous ingestion of external data points requiring triage.</p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-t-4 border-t-primary">
          <div className="p-4 border-b bg-card flex items-center gap-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "triaged")} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="pending" className="text-xs px-3 h-7">
                  Pending ({pendingData?.data?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="triaged" className="text-xs px-3 h-7">
                  Triaged ({triagedData?.data?.length || 0})
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
                  <TableHead className="w-[180px]">AI Classification</TableHead>
                  <TableHead className="w-[150px]">Received</TableHead>
                  <TableHead className="text-right w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></TableCell>
                  </TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No {tab} signals.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((signal) => (
                    <TableRow key={signal.id} className="group hover:bg-muted/30">
                      <TableCell className="font-mono text-xs uppercase text-muted-foreground">{signal.source}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[400px] truncate" title={signal.content}>{signal.content}</TableCell>
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
                            </>
                          ) : (
                            <>
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
    </AppLayout>
  );
}
