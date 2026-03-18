import { useRoute } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { useGetRisk, useListTreatments, useListKRIs, useAiEnrichRisk, useListIncidents, useListReviews, useUpdateRisk, useAiScoreSuggestions } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ArrowLeft, Sparkles, AlertCircle, Activity, ShieldCheck, Clock, Loader2, CheckCircle2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AiProvenance } from "@/components/ai/ai-provenance";
import { ScoreProgressionBar } from "@/components/score-progression-bar";
import { TreatmentsTab } from "./treatments-tab";

const AI_ENRICHMENT_SEPARATOR = "\n\n---AI Enrichment---\n";

function parseRiskDescription(description: string | null | undefined) {
  if (!description) return { base: null, enrichment: null };
  const idx = description.indexOf(AI_ENRICHMENT_SEPARATOR);
  if (idx === -1) return { base: description, enrichment: null };
  return {
    base: description.slice(0, idx),
    enrichment: description.slice(idx + AI_ENRICHMENT_SEPARATOR.length),
  };
}

interface ScorePair { likelihood: number; impact: number }

function ScoreSection({
  label,
  likelihood,
  impact,
  onSave,
  isSaving,
  aiSuggestion,
  aiConfidence,
  onAiSuggest,
  isAiLoading,
  onScoreChange,
}: {
  label: string;
  likelihood: number | null;
  impact: number | null;
  onSave: (l: number, i: number) => void;
  isSaving: boolean;
  aiSuggestion?: ScorePair;
  aiConfidence?: number;
  onAiSuggest: () => void;
  isAiLoading: boolean;
  onScoreChange: (score: number) => void;
}) {
  const savedL = likelihood ?? 1;
  const savedI = impact ?? 1;
  const [editL, setEditL] = useState(savedL);
  const [editI, setEditI] = useState(savedI);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setEditL(likelihood ?? 1);
    setEditI(impact ?? 1);
  }, [likelihood, impact]);

  const dirty = editL !== savedL || editI !== savedI;

  const updateL = (v: number) => {
    setEditL(v);
    onScoreChange(v * editI);
  };
  const updateI = (v: number) => {
    setEditI(v);
    onScoreChange(editL * v);
  };

  const score = editL * editI;
  const computeSeverity = (l: number, i: number) => {
    const s = l * i;
    if (s >= 15) return "critical";
    if (s >= 10) return "high";
    if (s >= 5) return "medium";
    return "low";
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold text-sm">{label}</span>
          <SeverityBadge severity={likelihood && impact ? computeSeverity(likelihood, impact) : "unknown"} />
        </div>
        {likelihood && impact && (
          <span className="text-sm font-mono text-muted-foreground">{likelihood * impact}/25</span>
        )}
      </button>
      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Likelihood</label>
              <select
                value={editL}
                onChange={(e) => updateL(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Impact</label>
              <select
                value={editI}
                onChange={(e) => updateI(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Score:</span>
              <span className="text-lg font-bold">{score}</span>
              <SeverityBadge severity={computeSeverity(editL, editI)} />
            </div>
          </div>
          {aiSuggestion && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">AI Suggestion: L={aiSuggestion.likelihood}, I={aiSuggestion.impact} (Score: {aiSuggestion.likelihood * aiSuggestion.impact})</span>
                  {aiConfidence != null && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {Math.round(aiConfidence * 100)}% confident
                    </span>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => {
                  if (aiSuggestion) {
                    setEditL(aiSuggestion.likelihood);
                    setEditI(aiSuggestion.impact);
                    onScoreChange(aiSuggestion.likelihood * aiSuggestion.impact);
                  }
                }}>
                  Apply
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isAiLoading}
              onClick={(e) => { e.stopPropagation(); onAiSuggest(); }}
            >
              {isAiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              AI Suggest
            </Button>
            <Button
              size="sm"
              disabled={!dirty || isSaving}
              onClick={() => onSave(editL, editI)}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskDetail() {
  const [, params] = useRoute("/risks/:id");
  const id = params?.id || "";
  const queryClient = useQueryClient();

  const { data: risk, isLoading } = useGetRisk(id);
  const { data: kris } = useListKRIs(id);
  const { data: incidents } = useListIncidents(id);
  const { data: reviews } = useListReviews(id);
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);

  interface AiSuggestionsState {
    inherent?: ScorePair;
    residual?: ScorePair;
    target?: ScorePair;
    confidence?: number;
    rationale?: string;
  }
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionsState | null>(null);

  const [liveInherentScore, setLiveInherentScore] = useState<number | null>(null);
  const [liveResidualScore, setLiveResidualScore] = useState<number | null>(null);
  const [liveTargetScore, setLiveTargetScore] = useState<number | null>(null);

  useEffect(() => {
    if (risk) {
      setLiveInherentScore((risk.likelihood ?? 1) * (risk.impact ?? 1));
      setLiveResidualScore(risk.residualLikelihood != null && risk.residualImpact != null ? risk.residualLikelihood * risk.residualImpact : null);
      setLiveTargetScore(risk.targetLikelihood != null && risk.targetImpact != null ? risk.targetLikelihood * risk.targetImpact : null);
    }
  }, [risk]);

  const enrichMutation = useAiEnrichRisk({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${id}`] });
      }
    }
  });

  const updateMutation = useUpdateRisk({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/risks/${id}`] });
      }
    }
  });

  const scoreSuggestionsMutation = useAiScoreSuggestions({
    mutation: {
      onSuccess: (data) => {
        const toScorePair = (obj: { likelihood?: number; impact?: number } | undefined): ScorePair | undefined => {
          if (obj?.likelihood != null && obj?.impact != null) return { likelihood: obj.likelihood, impact: obj.impact };
          return undefined;
        };
        setAiSuggestions({
          inherent: toScorePair(data.inherent),
          residual: toScorePair(data.residual),
          target: toScorePair(data.target),
          confidence: data.confidence,
          rationale: data.rationale,
        });
      }
    }
  });

  const handleAiSuggest = useCallback(() => {
    scoreSuggestionsMutation.mutate({ id });
  }, [id, scoreSuggestionsMutation]);

  const computeSeverity = (l?: number | null, i?: number | null) => {
    if (!l || !i) return 'unknown';
    const score = l * i;
    if (score >= 15) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };

  if (isLoading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div></AppLayout>;
  if (!risk) return <AppLayout><div className="p-8 text-center text-muted-foreground">Risk not found</div></AppLayout>;

  const { base: baseDescription, enrichment } = parseRiskDescription(risk.description);

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/risks">Risks</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{risk?.title ?? "Risk Detail"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center space-x-4 mb-4">
          <Link href="/risks">
            <Button variant="outline" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="font-mono text-sm text-muted-foreground">RISK-{risk.id?.split('-')[0].toUpperCase()}</div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{risk.title}</h1>
              <StatusBadge status={risk.status} className="text-sm px-3 py-1" />
              {enrichment && (
                <Badge variant="outline" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-primary/5 text-primary border-primary/20 font-medium">
                  <Sparkles className="h-3 w-3" />
                  AI Enhanced
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="capitalize border-r pr-4">{risk.category}</span>
              <span>Created {format(new Date(risk.createdAt || ''), 'MMM d, yyyy')}</span>
            </div>
          </div>
          
          <Button 
            variant="secondary" 
            onClick={() => enrichMutation.mutate({ id })}
            disabled={enrichMutation.isPending}
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5"
          >
            {enrichMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Sparkles className="h-4 w-4 mr-2" />}
            Enrich with AI
          </Button>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Score Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreProgressionBar
              inherentScore={liveInherentScore ?? (risk.likelihood ?? 1) * (risk.impact ?? 1)}
              residualScore={liveResidualScore}
              targetScore={liveTargetScore}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {baseDescription || "No description provided."}
              </p>
              {enrichment && (
                <div className="mt-4 border-t pt-4">
                  <Collapsible open={enrichmentOpen} onOpenChange={setEnrichmentOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors mb-2">
                      {enrichmentOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Enrichment
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{enrichment}</p>
                        <AiProvenance action="Enriched by" date={risk.updatedAt} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
              {enrichMutation.isSuccess && (
                <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-2">
                    <Sparkles className="h-4 w-4" />
                    AI Enrichment
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">Enrichment job queued. Results will appear after processing.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle>Risk Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(scoreSuggestionsMutation.isError || updateMutation.isError) && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-xs text-destructive font-medium">
                    {scoreSuggestionsMutation.isError ? "Failed to get AI suggestions. The AI service may be unavailable." : "Failed to save score. Please try again."}
                  </p>
                </div>
              )}

              {aiSuggestions?.rationale && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">AI Rationale</span>
                    {aiSuggestions.confidence != null && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {Math.round(aiSuggestions.confidence * 100)}% confident
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/70 leading-relaxed">{aiSuggestions.rationale}</p>
                </div>
              )}

              <ScoreSection
                label="Inherent Risk"
                likelihood={risk.likelihood ?? null}
                impact={risk.impact ?? null}
                isSaving={updateMutation.isPending}
                aiSuggestion={aiSuggestions?.inherent}
                aiConfidence={aiSuggestions?.confidence}
                onAiSuggest={handleAiSuggest}
                isAiLoading={scoreSuggestionsMutation.isPending}
                onScoreChange={(score) => setLiveInherentScore(score)}
                onSave={(l, i) => updateMutation.mutate({ id, data: { likelihood: l, impact: i } })}
              />

              <ScoreSection
                label="Residual Risk"
                likelihood={risk.residualLikelihood !== undefined ? risk.residualLikelihood : null}
                impact={risk.residualImpact !== undefined ? risk.residualImpact : null}
                isSaving={updateMutation.isPending}
                aiSuggestion={aiSuggestions?.residual}
                aiConfidence={aiSuggestions?.confidence}
                onAiSuggest={handleAiSuggest}
                isAiLoading={scoreSuggestionsMutation.isPending}
                onScoreChange={(score) => setLiveResidualScore(score)}
                onSave={(l, i) => updateMutation.mutate({ id, data: { residualLikelihood: l, residualImpact: i } })}
              />

              <ScoreSection
                label="Target Risk"
                likelihood={risk.targetLikelihood !== undefined ? risk.targetLikelihood : null}
                impact={risk.targetImpact !== undefined ? risk.targetImpact : null}
                isSaving={updateMutation.isPending}
                aiSuggestion={aiSuggestions?.target}
                aiConfidence={aiSuggestions?.confidence}
                onAiSuggest={handleAiSuggest}
                isAiLoading={scoreSuggestionsMutation.isPending}
                onScoreChange={(score) => setLiveTargetScore(score)}
                onSave={(l, i) => updateMutation.mutate({ id, data: { targetLikelihood: l, targetImpact: i } })}
              />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="treatments" className="w-full mt-8">
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger value="treatments" className="data-[state=active]:shadow-sm rounded-md"><ShieldCheck className="h-4 w-4 mr-2" /> Treatments</TabsTrigger>
            <TabsTrigger value="kris" className="data-[state=active]:shadow-sm rounded-md"><Activity className="h-4 w-4 mr-2" /> KRIs</TabsTrigger>
            <TabsTrigger value="incidents" className="data-[state=active]:shadow-sm rounded-md"><AlertCircle className="h-4 w-4 mr-2" /> Incidents</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:shadow-sm rounded-md"><Clock className="h-4 w-4 mr-2" /> Reviews</TabsTrigger>
          </TabsList>
          
          <div className="mt-6 bg-card border rounded-xl overflow-hidden shadow-sm min-h-[300px]">
            <TabsContent value="treatments" className="p-0 m-0 border-none outline-none">
              <TreatmentsTab
                riskId={id}
                inherentScore={(risk.likelihood || 1) * (risk.impact || 1)}
                residualLikelihood={risk.residualLikelihood}
                residualImpact={risk.residualImpact}
              />
            </TabsContent>
            <TabsContent value="kris" className="p-0 m-0 border-none outline-none">
               {kris?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No Key Risk Indicators tracked.</div>
              ) : (
                <div className="divide-y">
                  {kris?.data?.map(k => (
                    <div key={k.id} className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm mb-1">{k.name}</div>
                        <span className="text-xs text-muted-foreground">Warn: {k.warningThreshold} | Crit: {k.criticalThreshold}</span>
                      </div>
                      <div className="text-xl font-mono font-bold bg-muted px-3 py-1 rounded-md border">{k.currentValue} <span className="text-xs font-sans font-normal text-muted-foreground">{k.unit}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="incidents" className="p-0 m-0 border-none outline-none">
              {incidents?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No incidents reported.</div>
              ) : (
                <div className="divide-y">
                  {incidents?.data?.map(inc => (
                    <div key={inc.id} className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={inc.severity} />
                          <span className="font-semibold text-sm">{inc.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{inc.description}</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">{inc.occurredAt ? format(new Date(inc.occurredAt), 'MMM d, yyyy') : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="history" className="p-0 m-0 border-none outline-none">
              {!reviews?.data || reviews.data.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No review cycles recorded yet.</div>
              ) : (
                <div className="divide-y">
                  {reviews.data.map(review => (
                    <div key={review.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {review.completedAt ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-sm">
                            Review Cycle
                          </span>
                          <StatusBadge status={review.completedAt ? "completed" : "pending"} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          Due: {review.dueDate ? format(new Date(review.dueDate), 'MMM d, yyyy') : 'Not set'}
                        </span>
                      </div>
                      {review.notes && (
                        <p className="text-sm text-muted-foreground pl-6">{review.notes}</p>
                      )}
                      {review.completedAt && (
                        <div className="text-xs text-muted-foreground pl-6 mt-1">
                          Completed: {format(new Date(review.completedAt), 'MMM d, yyyy HH:mm')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
