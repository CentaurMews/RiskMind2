import { useState } from "react";
import { useListFindings } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/severity-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { GitMerge } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 20;

export default function FindingList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListFindings({ page: String(page), limit: String(PAGE_SIZE) });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Findings Pipeline</h1>
          <p className="text-muted-foreground mt-1">Triaged signals undergoing investigation and correlation.</p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 shadow-sm">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Correlations</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Empty className="border-0">
                        <EmptyMedia variant="icon"><GitMerge /></EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No findings yet</EmptyTitle>
                          <EmptyDescription>Findings are created when signals are triaged and correlated.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((finding) => (
                    <TableRow key={finding.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">FND-{finding.id?.split('-')[0]}</TableCell>
                      <TableCell className="font-medium">{finding.title}</TableCell>
                      <TableCell><StatusBadge status={finding.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                          <GitMerge className="h-3 w-3" />
                          {finding.riskId && <span className="bg-muted px-1.5 py-0.5 rounded">Risk</span>}
                          {finding.vendorId && <span className="bg-muted px-1.5 py-0.5 rounded">Vendor</span>}
                          {!finding.riskId && !finding.vendorId && <span>Uncorrelated</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(finding.createdAt || ''), 'MMM d, yyyy')}</TableCell>
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
