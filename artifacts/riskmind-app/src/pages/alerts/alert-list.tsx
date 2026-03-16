import { useListAlerts, useAcknowledgeAlert } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function AlertList() {
  const { data, isLoading } = useListAlerts();
  const queryClient = useQueryClient();

  const ackMutation = useAcknowledgeAlert({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/v1/alerts"] })
    }
  });

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active Alerts</h1>
          <p className="text-muted-foreground mt-1">System and AI-generated alerts requiring acknowledgment.</p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-t-4 border-t-destructive">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead>Alert Details</TableHead>
                  <TableHead className="w-[120px]">Severity</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[150px]">Triggered</TableHead>
                  <TableHead className="text-right w-[120px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No alerts found.</TableCell></TableRow>
                ) : (
                  data?.data?.map((alert) => (
                    <TableRow key={alert.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs uppercase text-muted-foreground">{alert.type}</TableCell>
                      <TableCell className="font-medium text-sm">{alert.title}</TableCell>
                      <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                      <TableCell><StatusBadge status={alert.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(alert.createdAt || ''), 'MMM d, HH:mm')}</TableCell>
                      <TableCell className="text-right">
                        {alert.status === 'active' || alert.status === 'escalated' ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => ackMutation.mutate({ id: alert.id! })}
                            disabled={ackMutation.isPending}
                            className="text-xs"
                          >
                            Acknowledge
                          </Button>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 ml-auto text-muted-foreground" />
                        )}
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
