import { useRoute, Link } from "wouter";
import { useGetFramework, useGetComplianceScore, useGetGapAnalysis } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function FrameworkDetail() {
  const [, params] = useRoute("/compliance/:id");
  const id = params?.id || "";

  const { data: framework, isLoading: isFwLoading } = useGetFramework(id);
  const { data: score } = useGetComplianceScore(id);
  const { data: gaps } = useGetGapAnalysis(id);

  if (isFwLoading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div></AppLayout>;
  if (!framework) return <AppLayout><div className="p-8 text-center text-muted-foreground">Framework not found</div></AppLayout>;

  const coveragePercent = score?.coverageScore || 0;
  const scoreValue = score?.score || 0;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center space-x-4 mb-4">
          <Link href="/compliance">
            <Button variant="outline" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="font-mono text-sm text-muted-foreground">{framework.name} {framework.version}</div>
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
              <CardTitle className="text-lg">Compliance Score</CardTitle>
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
                  <Progress value={coveragePercent} className="h-2 bg-secondary" indicatorClassName="bg-primary" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium text-muted-foreground">
                    <span>Mapped Controls</span>
                    <span>{score?.totalControls || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Gap Analysis</h2>
          <Card className="shadow-sm">
            <div className="divide-y">
              {gaps?.requirements?.map(req => (
                <div key={req.requirementId} className="p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                  <div className="pt-0.5">
                    {req.status === 'covered' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    {req.status === 'partial' && <Zap className="h-5 w-5 text-yellow-500" />}
                    {req.status === 'gap' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm font-bold bg-secondary px-2 py-0.5 rounded border">{req.code}</span>
                      <span className="font-semibold">{req.title}</span>
                    </div>
                    {req.controls && req.controls.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {req.controls.map(c => (
                          <span key={c.id} className="text-xs bg-muted border px-2 py-1 rounded font-medium flex items-center">
                            {c.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-destructive mt-1 font-medium">No controls mapped to this requirement.</p>
                    )}
                  </div>
                </div>
              ))}
              {!gaps?.requirements?.length && (
                <div className="p-12 text-center text-muted-foreground">Analysis not available.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
