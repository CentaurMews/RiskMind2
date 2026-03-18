import { useState } from "react";
import { useListAlerts, useAcknowledgeAlert, type ListAlertsSeverity } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Bell, Search, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

export default function AlertList() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: rawData, isLoading } = useListAlerts({
    ...(severityFilter !== "all" ? { severity: severityFilter as ListAlertsSeverity } : {}),
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  // Client-side search filtering (API doesn't support search param for alerts)
  const data = search
    ? { ...rawData, data: rawData?.data?.filter(a => a.title?.toLowerCase().includes(search.toLowerCase()) || a.type?.toLowerCase().includes(search.toLowerCase())) }
    : rawData;
  const queryClient = useQueryClient();

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const ackMutation = useAcknowledgeAlert({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/v1/alerts"] }),
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Failed to acknowledge alert",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    }
  });

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Active Alerts</h1>
            <p className="text-muted-foreground mt-1">System and AI-generated alerts requiring acknowledgment.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 w-[180px]"
                placeholder="Search alerts..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={severityFilter} onValueChange={v => { setSeverityFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[90px]" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Empty className="border-0">
                        <EmptyMedia variant="icon"><Bell /></EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No alerts found</EmptyTitle>
                          <EmptyDescription>System and AI alerts will appear here.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
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
