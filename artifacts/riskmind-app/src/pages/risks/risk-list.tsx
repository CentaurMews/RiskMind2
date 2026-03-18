import { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useListRisks, useCreateRisk, useGetMe, type RiskCategory, type RiskSourceInput } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Filter, Loader2, ArrowRight, Sparkles, X, Brain, ChevronDown, ChevronUp, Download, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { InterviewDialog } from "@/components/ai-interview/interview-dialog";
import { AiIntelligencePanel } from "@/components/risk-creation/ai-intelligence-panel";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SourceItem {
  id: string;
  sourceType: "signal" | "finding" | "agent_detection";
  title: string;
  description: string;
  confidence?: number;
  category?: string;
  severity?: string;
}

const ALL_STATUSES = [
  { value: "open", label: "Open" },
  { value: "draft", label: "Draft" },
  { value: "mitigated", label: "Mitigated" },
  { value: "accepted", label: "Accepted" },
  { value: "closed", label: "Closed" },
] as const;

const ALL_STRATEGIES = [
  { value: "treat", label: "Treat" },
  { value: "transfer", label: "Transfer" },
  { value: "tolerate", label: "Tolerate" },
  { value: "terminate", label: "Terminate" },
] as const;

const HISTORICAL_STATUSES = new Set(["accepted", "closed"]);

const DEFAULT_STATUSES = ["open", "mitigated", "accepted"];

const PAGE_SIZE = 20;

export default function RiskList() {
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: user } = useGetMe({ query: { queryKey: ["/api/v1/auth/me"] } });
  const canEdit = user?.role === "admin" || user?.role === "risk_manager";

  const statusParam = selectedStatuses.length > 0 && selectedStatuses.length < 5
    ? selectedStatuses.join(",")
    : undefined;

  const strategyParam = selectedStrategies.length > 0 ? selectedStrategies.join(",") : undefined;

  const { data, isLoading } = useListRisks({
    search: search || undefined,
    status: statusParam,
    treatmentStrategy: strategyParam,
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const [isOpen, setIsOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<SourceItem[]>([]);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "operational" as RiskCategory,
    likelihood: "3",
    impact: "3"
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const findingId = params.get("findingId");
    const prefillTitle = params.get("title");
    const prefillDesc = params.get("description");
    const prefillCategory = params.get("category");
    const prefillLikelihood = params.get("likelihood");
    const prefillImpact = params.get("impact");

    if (findingId || prefillTitle) {
      setFormData({
        title: prefillTitle || "",
        description: prefillDesc || "",
        category: (prefillCategory as RiskCategory) || "operational",
        likelihood: prefillLikelihood || "3",
        impact: prefillImpact || "3",
      });
      if (findingId) {
        setSelectedSources([{
          id: findingId,
          sourceType: "finding",
          title: prefillTitle || "Finding",
          description: prefillDesc || "",
          category: prefillCategory || undefined,
        }]);
      }
      setIsOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const createMutation = useCreateRisk({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
        setIsOpen(false);
        resetForm();
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Failed to create risk",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    }
  });

  const resetForm = useCallback(() => {
    setFormData({
      title: "",
      description: "",
      category: "operational" as RiskCategory,
      likelihood: "3",
      impact: "3",
    });
    setSelectedSources([]);
    setShowMobilePanel(false);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  }, [resetForm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sources: RiskSourceInput[] = selectedSources.map(s => ({
      sourceType: s.sourceType,
      sourceId: s.id,
    }));
    createMutation.mutate({
      data: {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        likelihood: parseInt(formData.likelihood),
        impact: parseInt(formData.impact),
        ...(sources.length > 0 ? { sources } : {}),
      }
    });
  };

  const handleSelectSource = useCallback((source: SourceItem) => {
    setSelectedSources(prev => [...prev, source]);
    setFormData(prev => ({
      ...prev,
      title: source.title.slice(0, 200),
      description: source.description?.slice(0, 500) || prev.description,
      ...(source.category && ["operational", "financial", "compliance", "strategic", "technology", "reputational"].includes(source.category)
        ? { category: source.category as RiskCategory }
        : {}),
    }));
  }, []);

  const handleDeselectSource = useCallback((sourceId: string) => {
    setSelectedSources(prev => prev.filter(s => s.id !== sourceId));
  }, []);

  const toggleStatus = (status: string) => {
    setPage(1);
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleStrategy = (strategy: string) => {
    setPage(1);
    setSelectedStrategies(prev =>
      prev.includes(strategy) ? prev.filter(s => s !== strategy) : [...prev, strategy]
    );
  };

  const computeSeverity = (l?: number, i?: number) => {
    if (!l || !i) return 'unknown';
    const score = l * i;
    if (score >= 15) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };

  const handleExportCSV = () => {
    const items = data?.data ?? [];
    const headers = ["ID", "Title", "Category", "Severity", "Status", "Likelihood", "Impact", "Created"];
    const rows = items.map(r => {
      const score = (r.likelihood ?? 0) * (r.impact ?? 0);
      const severity = score >= 17 ? "critical" : score >= 10 ? "high" : score >= 5 ? "medium" : "low";
      return [r.id?.split('-')[0], `"${(r.title ?? '').replace(/"/g, '""')}"`, r.category, severity, r.status, r.likelihood, r.impact, format(new Date(r.createdAt || ''), 'yyyy-MM-dd')].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `risks-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = (selectedStatuses.join(",") !== DEFAULT_STATUSES.join(",") ? 1 : 0)
    + (selectedStrategies.length > 0 ? 1 : 0);

  const risks = data?.data || [];

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Risk Register</h1>
            <p className="text-muted-foreground mt-1">Manage and track enterprise risks across all domains.</p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Sheet open={isOpen} onOpenChange={handleOpenChange}>
                <SheetTrigger asChild>
                  <Button className="shadow-md">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Risk
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-3xl w-full border-l overflow-y-auto p-0">
                  <div className="flex h-full">
                    <div className="flex-1 min-w-0 flex flex-col">
                      <SheetHeader className="px-6 pt-6 pb-4">
                        <SheetTitle>Create New Risk</SheetTitle>
                        <SheetDescription>Log a new risk into the enterprise register. Use the AI panel to find related intelligence.</SheetDescription>
                      </SheetHeader>

                      <div className="flex-1 overflow-y-auto px-6 pb-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                          {selectedSources.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Linked Sources</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedSources.map(s => (
                                  <Badge key={s.id} variant="secondary" className="text-xs pr-1 gap-1">
                                    {s.sourceType === "signal" ? "Signal" : s.sourceType === "finding" ? "Finding" : "Detection"}: {s.title.slice(0, 30)}
                                    <button type="button" onClick={() => handleDeselectSource(s.id)} className="ml-1 hover:text-destructive">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Data Breach via Third-Party" />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <textarea
                              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-y"
                              value={formData.description}
                              onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as typeof formData.category})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="operational">Operational</SelectItem>
                                <SelectItem value="financial">Financial</SelectItem>
                                <SelectItem value="compliance">Compliance</SelectItem>
                                <SelectItem value="strategic">Strategic</SelectItem>
                                <SelectItem value="technology">Technology</SelectItem>
                                <SelectItem value="reputational">Reputational</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Likelihood (1-5)</Label>
                              <Input type="number" min="1" max="5" required value={formData.likelihood} onChange={e => setFormData({...formData, likelihood: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label>Impact (1-5)</Label>
                              <Input type="number" min="1" max="5" required value={formData.impact} onChange={e => setFormData({...formData, impact: e.target.value})} />
                            </div>
                          </div>

                          <div className="md:hidden">
                            <button
                              type="button"
                              onClick={() => setShowMobilePanel(!showMobilePanel)}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
                            >
                              <span className="flex items-center gap-2 font-medium">
                                <Brain className="h-4 w-4 text-primary" />
                                AI Intelligence
                                {selectedSources.length > 0 && (
                                  <Badge variant="secondary" className="text-[10px]">{selectedSources.length}</Badge>
                                )}
                              </span>
                              {showMobilePanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            {showMobilePanel && (
                              <div className="mt-2 border rounded-lg h-[300px] overflow-hidden">
                                <AiIntelligencePanel
                                  searchText={formData.title + " " + formData.description}
                                  selectedSources={selectedSources}
                                  onSelectSource={handleSelectSource}
                                  onDeselectSource={handleDeselectSource}
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                              Save Risk
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsOpen(false);
                                setInterviewOpen(true);
                              }}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Guide Me
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>

                    <div className="hidden md:flex w-[300px] border-l bg-muted/20 flex-col min-h-0">
                      <AiIntelligencePanel
                        searchText={formData.title + " " + formData.description}
                        selectedSources={selectedSources}
                        onSelectSource={handleSelectSource}
                        onDeselectSource={handleDeselectSource}
                      />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        <InterviewDialog
          open={interviewOpen}
          onOpenChange={setInterviewOpen}
          type="risk_creation"
          onCommitted={(resultId) => {
            queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
            if (resultId) navigate(`/risks/${resultId}`);
          }}
        />

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-card flex items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search risks..."
                className="pl-9 bg-muted/50"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="relative">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4 space-y-4" align="end">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</div>
                    <div className="space-y-2">
                      {ALL_STATUSES.map(({ value, label }) => (
                        <div key={value} className="flex items-center gap-2">
                          <Checkbox
                            id={`status-${value}`}
                            checked={selectedStatuses.includes(value)}
                            onCheckedChange={() => toggleStatus(value)}
                          />
                          <label htmlFor={`status-${value}`} className="text-sm cursor-pointer flex items-center gap-2">
                            {label}
                            {HISTORICAL_STATUSES.has(value) && (
                              <span className="text-[10px] text-muted-foreground italic">(historical)</span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Treatment Strategy</div>
                    <div className="space-y-2">
                      {ALL_STRATEGIES.map(({ value, label }) => (
                        <div key={value} className="flex items-center gap-2">
                          <Checkbox
                            id={`strategy-${value}`}
                            checked={selectedStrategies.includes(value)}
                            onCheckedChange={() => toggleStrategy(value)}
                          />
                          <label htmlFor={`strategy-${value}`} className="text-sm cursor-pointer">{label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(selectedStatuses.join(",") !== DEFAULT_STATUSES.join(",") || selectedStrategies.length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground text-xs"
                      onClick={() => {
                        setSelectedStatuses(DEFAULT_STATUSES);
                        setSelectedStrategies([]);
                        setPage(1);
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Reset to defaults
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {(selectedStatuses.length > 0 || selectedStrategies.length > 0) && (
            <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2 flex-wrap">
              {selectedStatuses.map(s => (
                <Badge key={s} variant="secondary" className="text-xs capitalize pr-1">
                  {s}
                  <button onClick={() => toggleStatus(s)} className="ml-1 hover:text-destructive">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {selectedStrategies.map(s => (
                <Badge key={s} variant="outline" className="text-xs capitalize pr-1">
                  {s}
                  <button onClick={() => toggleStrategy(s)} className="ml-1 hover:text-destructive">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[220px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : risks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Empty className="border-0">
                        <EmptyMedia variant="icon"><ShieldAlert /></EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No risks found</EmptyTitle>
                          <EmptyDescription>Adjust your filters or create your first risk.</EmptyDescription>
                        </EmptyHeader>
                        {canEdit && (
                          <EmptyContent>
                            <Button size="sm" onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Risk</Button>
                          </EmptyContent>
                        )}
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  risks.map((risk) => {
                    const isHistorical = HISTORICAL_STATUSES.has(risk.status || "");
                    return (
                      <TableRow key={risk.id} className={`group hover:bg-muted/30 transition-colors${isHistorical ? " opacity-60" : ""}`}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{risk.id?.split('-')[0]}</TableCell>
                        <TableCell className="font-medium">
                          {risk.title}
                          {isHistorical && (
                            <span className="ml-2 text-[10px] text-muted-foreground italic">historical</span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{risk.category}</TableCell>
                        <TableCell>
                          <SeverityBadge severity={computeSeverity(risk.likelihood, risk.impact)} />
                          <span className="text-xs text-muted-foreground ml-2 font-mono hidden lg:inline">
                            ({risk.likelihood}×{risk.impact})
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={risk.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(risk.createdAt || ''), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/risks/${risk.id}`}>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page === 1 ? "pointer-events-none opacity-50" : ""} />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 py-2 text-sm">{page} / {totalPages}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page >= totalPages ? "pointer-events-none opacity-50" : ""} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </AppLayout>
  );
}
