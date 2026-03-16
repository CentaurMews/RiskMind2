import { AppLayout } from "@/components/layout/app-layout";
import { useGetMe, useListLlmProviders, useGetAgentConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Bot, Server, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { data: user } = useGetMe();
  const { data: providers, isLoading: providersLoading } = useListLlmProviders();
  const { data: agentConfig, isLoading: agentLoading } = useGetAgentConfig();

  if (user?.role !== 'admin') {
    return (
      <AppLayout>
        <div className="p-12 text-center h-full flex flex-col justify-center items-center">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">You do not have the required permissions to view tenant settings. Only administrators can access this page.</p>
          <Link href="/dashboard"><Button variant="outline" className="mt-6">Return to Dashboard</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Settings</h1>
          <p className="text-muted-foreground mt-1">Manage configuration for {user.tenantId.split('-')[0]}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Bot className="h-5 w-5 mr-2"/> Autonomous Agent</CardTitle>
              <CardDescription>Configuration for the Risk Intelligence Agent.</CardDescription>
            </CardHeader>
            <CardContent>
              {agentLoading ? <Loader2 className="animate-spin" /> : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b">
                    <div>
                      <div className="font-medium">Agent Status</div>
                      <div className="text-sm text-muted-foreground">Master toggle for automated runs</div>
                    </div>
                    <div className="font-mono text-sm bg-secondary px-3 py-1 rounded">{agentConfig?.enabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b">
                    <div>
                      <div className="font-medium">Policy Tier</div>
                      <div className="text-sm text-muted-foreground">Defines execution autonomy</div>
                    </div>
                    <div className="font-mono text-sm capitalize bg-secondary px-3 py-1 rounded">{agentConfig?.policyTier}</div>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <div>
                      <div className="font-medium">Schedule (Cron)</div>
                      <div className="text-sm text-muted-foreground">When the agent wakes up</div>
                    </div>
                    <div className="font-mono text-sm bg-secondary px-3 py-1 rounded">{agentConfig?.schedule}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Server className="h-5 w-5 mr-2"/> LLM Providers</CardTitle>
              <CardDescription>Configured language models for AI features.</CardDescription>
            </CardHeader>
            <CardContent>
              {providersLoading ? <Loader2 className="animate-spin" /> : (
                <div className="space-y-4">
                  {providers?.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {p.name}
                          {p.isDefault && <span className="text-[10px] uppercase font-bold tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Default</span>}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">{p.model} • {p.providerType}</div>
                      </div>
                      <div className="text-sm font-medium text-emerald-600">Active</div>
                    </div>
                  ))}
                  {providers?.length === 0 && <div className="text-sm text-muted-foreground">No providers configured.</div>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
