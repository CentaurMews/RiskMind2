import { useRoute } from "wouter";
import { useGetRisk, useListTreatments, useListKRIs, useAiEnrichRisk, useListIncidents } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Sparkles, AlertCircle, Activity, ShieldCheck, Clock, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function RiskDetail() {
  const [, params] = useRoute("/risks/:id");
  const id = params?.id || "";
  const queryClient = useQueryClient();

  const { data: risk, isLoading } = useGetRisk(id);
  const { data: treatments } = useListTreatments(id);
  const { data: kris } = useListKRIs(id);
  const { data: incidents } = useListIncidents(id);

  const enrichMutation = useAiEnrichRisk({
    mutation: {
      onSuccess: () => {
        // Optimistically could show a toast
      }
    }
  });

  const computeSeverity = (l?: number, i?: number) => {
    if (!l || !i) return 'unknown';
    const score = l * i;
    if (score >= 15) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };

  if (isLoading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div></AppLayout>;
  if (!risk) return <AppLayout><div className="p-8 text-center text-muted-foreground">Risk not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {risk.description || "No description provided."}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-muted/20">
            <CardHeader>
              <CardTitle>Inherent Risk Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b">
                <span className="text-sm font-medium">Severity</span>
                <SeverityBadge severity={computeSeverity(risk.likelihood, risk.impact)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Likelihood</span>
                  <div className="text-2xl font-bold">{risk.likelihood}/5</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Impact</span>
                  <div className="text-2xl font-bold">{risk.impact}/5</div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <span className="text-xs text-muted-foreground block mb-2">Residual Risk (Target)</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm bg-background px-2 py-1 rounded border">L: {risk.residualLikelihood || '-'}</span>
                  <span className="font-mono text-sm bg-background px-2 py-1 rounded border">I: {risk.residualImpact || '-'}</span>
                </div>
              </div>
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
              {treatments?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No treatments defined.</div>
              ) : (
                <div className="divide-y">
                  {treatments?.data?.map(t => (
                    <div key={t.id} className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{t.description}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground capitalize">Strategy: {t.strategy}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{t.dueDate ? format(new Date(t.dueDate), 'MMM d, yyyy') : 'No date'}</div>
                    </div>
                  ))}
                </div>
              )}
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
            <TabsContent value="history" className="p-12 text-center text-muted-foreground">
              Review history log goes here.
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
