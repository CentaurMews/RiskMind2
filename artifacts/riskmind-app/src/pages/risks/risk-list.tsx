import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useListRisks, useCreateRisk, type RiskCategory } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Plus, Search, Filter, Loader2, ArrowRight, Sparkles, X, Brain, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { InterviewDialog } from "@/components/ai-interview/interview-dialog";
import { AiIntelligencePanel } from "@/components/risk-creation/ai-intelligence-panel";
import { DocumentAnalysisPanel, type PopulateFormPayload } from "@/components/risk-creation/document-analysis-panel";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SourceItem {
  id: string;
  sourceType: "signal" | "finding" | "agent_detection";
  title: string;
  description: string;
  confidence?: number;
  category?: string;
  severity?: string;
}

export default function RiskList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListRisks({ search: search || undefined });
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<SourceItem[]>([]);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"intelligence" | "documents">("intelligence");
  const formRef = useRef<HTMLDivElement>(null);
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
      }
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
    const sources = selectedSources.map(s => ({
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

  const handlePopulateFromDocument = useCallback(({ risk, documentSignalId }: PopulateFormPayload) => {
    const validCategories = ["operational", "financial", "compliance", "strategic", "technology", "reputational"];
    setFormData({
      title: risk.title.slice(0, 200),
      description: risk.description.slice(0, 500),
      category: (validCategories.includes(risk.category) ? risk.category : "operational") as RiskCategory,
      likelihood: String(Math.max(1, Math.min(5, risk.likelihood))),
      impact: String(Math.max(1, Math.min(5, risk.impact))),
    });
    if (documentSignalId) {
      setSelectedSources(prev => {
        const alreadyAdded = prev.some(s => s.id === documentSignalId);
        if (alreadyAdded) return prev;
        return [...prev, {
          id: documentSignalId,
          sourceType: "signal" as const,
          title: risk.title,
          description: `From document analysis`,
        }];
      });
    }
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleDeselectSource = useCallback((sourceId: string) => {
    setSelectedSources(prev => prev.filter(s => s.id !== sourceId));
  }, []);

  const computeSeverity = (l?: number, i?: number) => {
    if (!l || !i) return 'unknown';
    const score = l * i;
    if (score >= 15) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Risk Register</h1>
            <p className="text-muted-foreground mt-1">Manage and track enterprise risks across all domains.</p>
          </div>
          
          <div className="flex items-center gap-2">
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
                      <SheetDescription>Log a new risk into the enterprise register. Use the AI panel to find related intelligence or analyse a document.</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div ref={formRef} />

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
                            <div className="mt-2 border rounded-lg p-3 space-y-3">
                              <Tabs value={rightPanelTab} onValueChange={v => setRightPanelTab(v as "intelligence" | "documents")}>
                                <TabsList className="w-full h-8">
                                  <TabsTrigger value="intelligence" className="flex-1 text-xs">
                                    <Brain className="h-3 w-3 mr-1" />Intelligence
                                  </TabsTrigger>
                                  <TabsTrigger value="documents" className="flex-1 text-xs">
                                    <FileText className="h-3 w-3 mr-1" />Documents
                                  </TabsTrigger>
                                </TabsList>
                                <TabsContent value="intelligence" className="h-[300px] overflow-hidden mt-2">
                                  <AiIntelligencePanel
                                    searchText={formData.title + " " + formData.description}
                                    selectedSources={selectedSources}
                                    onSelectSource={handleSelectSource}
                                    onDeselectSource={handleDeselectSource}
                                  />
                                </TabsContent>
                                <TabsContent value="documents" className="mt-2">
                                  <DocumentAnalysisPanel onPopulateForm={handlePopulateFromDocument} />
                                </TabsContent>
                              </Tabs>
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

                  <div className="hidden md:flex w-[320px] border-l bg-muted/20 flex-col min-h-0">
                    <Tabs value={rightPanelTab} onValueChange={v => setRightPanelTab(v as "intelligence" | "documents")} className="flex flex-col h-full">
                      <div className="px-3 pt-3 pb-0">
                        <TabsList className="w-full h-8">
                          <TabsTrigger value="intelligence" className="flex-1 text-xs">
                            <Brain className="h-3 w-3 mr-1" />Intelligence
                          </TabsTrigger>
                          <TabsTrigger value="documents" className="flex-1 text-xs">
                            <FileText className="h-3 w-3 mr-1" />Documents
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent value="intelligence" className="flex-1 min-h-0 mt-0 overflow-hidden">
                        <AiIntelligencePanel
                          searchText={formData.title + " " + formData.description}
                          selectedSources={selectedSources}
                          onSelectSource={handleSelectSource}
                          onDeselectSource={handleDeselectSource}
                        />
                      </TabsContent>
                      <TabsContent value="documents" className="flex-1 min-h-0 mt-0 overflow-y-auto">
                        <div className="p-3">
                          <DocumentAnalysisPanel onPopulateForm={handlePopulateFromDocument} />
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" /> Filter
            </Button>
          </div>
          
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
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No risks found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((risk) => (
                    <TableRow key={risk.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{risk.id?.split('-')[0]}</TableCell>
                      <TableCell className="font-medium">{risk.title}</TableCell>
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
