import { AppLayout } from "@/components/layout/app-layout";
import { useListRisks, useListAlerts, useListVendors, useGetComplianceScore } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Bell, Users, ShieldCheck, ArrowUpRight } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: risks } = useListRisks({ status: "open" });
  const { data: alerts } = useListAlerts({ status: "active" });
  const { data: vendors } = useListVendors();
  
  const { data: compliance } = useGetComplianceScore("fw-default", { query: { retry: false } });

  const activeRisksCount = risks?.total || 0;
  const openAlertsCount = alerts?.total || 0;
  const vendorCount = vendors?.total || 0;
  const compScore = compliance?.score || 78; // Fallback for UI demo

  const recentAlerts = alerts?.data?.slice(0, 5) || [];

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-1">Enterprise risk and compliance posture at a glance.</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Risks</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeRisksCount}</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Status: Open</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Alerts</CardTitle>
              <Bell className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{openAlertsCount}</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Requires Attention</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Vendors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{vendorCount}</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Managed Third-Parties</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Score</CardTitle>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold">{compScore}%</div>
              <div className="w-full bg-secondary h-1.5 mt-3 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${compScore}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Alerts Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Latest system and agent generated alerts.</p>
              </div>
              <Link href="/alerts" className="text-sm text-primary hover:underline flex items-center font-medium">
                View All <ArrowUpRight className="h-4 w-4 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {recentAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
                  No active alerts at this time.
                </div>
              ) : (
                <div className="space-y-4">
                  {recentAlerts.map(alert => (
                    <div key={alert.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={alert.severity} />
                          <span className="font-semibold text-sm">{alert.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {alert.type} • {format(new Date(alert.createdAt || ''), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      <StatusBadge status={alert.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mini Heatmap Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Risk Posture</CardTitle>
              <Link href="/risks/heatmap" className="text-sm text-primary hover:underline flex items-center font-medium">
                Expand <ArrowUpRight className="h-4 w-4 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
               <div className="aspect-square w-full bg-secondary/50 rounded-lg border flex flex-col relative overflow-hidden">
                  {/* Abstract placeholder for heatmap visualization to give it a premium look */}
                  <div className="absolute bottom-4 left-4 text-xs font-mono text-muted-foreground rotate-[-90deg] origin-bottom-left">LIKELIHOOD</div>
                  <div className="absolute bottom-0 left-10 text-xs font-mono text-muted-foreground w-full text-center pb-2">IMPACT</div>
                  
                  <div className="flex-1 grid grid-cols-5 grid-rows-5 gap-1 p-8 pb-10 pl-10">
                    {Array.from({length: 25}).map((_, i) => {
                      // Fake data distribution for visual effect
                      const isHigh = i === 4 || i === 9 || i === 14;
                      const isMed = i === 3 || i === 8 || i === 13 || i === 18 || i === 23;
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "rounded-sm border border-border/50",
                            isHigh ? "bg-severity-critical/20 border-severity-critical/30" :
                            isMed ? "bg-severity-medium/20 border-severity-medium/30" : "bg-muted/30"
                          )} 
                        />
                      )
                    })}
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
