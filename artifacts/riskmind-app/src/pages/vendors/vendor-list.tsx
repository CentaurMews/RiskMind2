import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListVendors, useGetMe } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Plus, Search, Building2, ArrowRight, LayoutGrid, List } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  identification: "Identification",
  due_diligence: "Due Diligence",
  risk_assessment: "Risk Assessment",
  contracting: "Contracting",
  onboarding: "Onboarding",
  monitoring: "Monitoring",
  offboarding: "Offboarding",
};

const STAGES = [
  { id: "identification", label: "Identification" },
  { id: "due_diligence", label: "Due Diligence" },
  { id: "risk_assessment", label: "Risk Assessment" },
  { id: "contracting", label: "Contracting" },
  { id: "onboarding", label: "Onboarding" },
  { id: "monitoring", label: "Monitoring" },
  { id: "offboarding", label: "Offboarding" },
];

const PAGE_SIZE = 20;

function LifecycleBadge({ status }: { status?: string }) {
  const s = status || "identification";
  const label = STATUS_LABELS[s] || s;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] px-2 py-0.5 tracking-wider font-medium",
        (s === "monitoring" || s === "onboarding") && "bg-primary/10 text-primary border-primary/20",
        (s === "identification" || s === "due_diligence" || s === "risk_assessment" || s === "contracting") && "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
        s === "offboarding" && "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
      )}
    >
      {label}
    </Badge>
  );
}

function TierBadge({ tier }: { tier?: string }) {
  const t = tier || "low";
  const colorMap: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize font-medium", colorMap[t])}>
      {t}
    </Badge>
  );
}

export default function VendorList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [, navigate] = useLocation();

  const queryClient = useQueryClient();

  const { data: user } = useGetMe({ query: { queryKey: ["/api/v1/auth/me"] } });
  const canEdit = user?.role === "admin" || user?.role === "risk_manager";

  // Table view query
  const { data, isLoading } = useListVendors({ search: search || undefined, page: String(page), limit: String(PAGE_SIZE) });
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  // Kanban view query — fetch all vendors
  const { data: allVendors } = useListVendors(
    { limit: "200" },
    { query: { enabled: viewMode === "kanban", queryKey: ["/api/v1/vendors", "kanban"] } }
  );

  const columns = STAGES.map(stage => ({
    ...stage,
    vendors: allVendors?.data?.filter(v => v.status === stage.id) || [],
  }));

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Third-Party Risk</h1>
            <p className="text-muted-foreground mt-1">Manage vendor lifecycle and compliance.</p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button className="shadow-md" onClick={() => navigate("/vendors/onboard/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              className="pl-9 bg-muted/50"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === "table" ? (
          <>
            <Card className="flex-1 flex flex-col min-h-0 shadow-sm">
              <div className="flex-1 overflow-auto scroll-shadow-x">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Last Assessment</TableHead>
                      <TableHead>Findings</TableHead>
                      <TableHead>Lifecycle Stage</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-[160px]" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-[40px]" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-[60px] rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[30px]" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-[100px] rounded-full" /></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))
                    ) : data?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Empty className="border-0">
                            <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
                            <EmptyHeader>
                              <EmptyTitle>No vendors found</EmptyTitle>
                              <EmptyDescription>Add your first third-party vendor to begin lifecycle tracking.</EmptyDescription>
                            </EmptyHeader>
                            {canEdit && (
                              <EmptyContent>
                                <Button size="sm" onClick={() => navigate("/vendors/onboard/new")}><Plus className="h-4 w-4 mr-2" />Add Vendor</Button>
                              </EmptyContent>
                            )}
                          </Empty>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data?.map((vendor) => {
                        const score = vendor.riskScore != null ? Number(vendor.riskScore) : null;
                        return (
                          <TableRow key={vendor.id} className="group hover:bg-muted/30 cursor-pointer">
                            <TableCell className="font-medium flex items-center">
                              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center mr-3 border">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              {vendor.name}
                            </TableCell>
                            <TableCell>
                              {score != null ? (
                                <span className={cn(
                                  "font-mono text-sm font-bold",
                                  score >= 8 ? "text-red-600" : score >= 5 ? "text-amber-600" : "text-emerald-600"
                                )}>
                                  {score}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <TierBadge tier={vendor.tier} />
                            </TableCell>
                            <TableCell>
                              {(vendor as { lastAssessmentDate?: string | null }).lastAssessmentDate ? (
                                <span className="text-xs">{format(new Date((vendor as { lastAssessmentDate: string }).lastAssessmentDate), "MMM d, yyyy")}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">Never</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {((vendor as { openFindingsCount?: number }).openFindingsCount ?? 0) > 0 ? (
                                <span className="text-xs font-mono text-amber-600">{(vendor as { openFindingsCount: number }).openFindingsCount}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">0</span>
                              )}
                            </TableCell>
                            <TableCell><LifecycleBadge status={vendor.status} /></TableCell>
                            <TableCell className="text-right">
                              <Link href={`/vendors/${vendor.id}`}>
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
          </>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4">
              {columns.map(col => (
                <div key={col.id} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    <Badge variant="secondary" className="text-xs">{col.vendors.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {col.vendors.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-muted p-4 text-center text-xs text-muted-foreground">
                        No vendors
                      </div>
                    ) : (
                      col.vendors.map(v => {
                        const score = v.riskScore != null ? Number(v.riskScore) : null;
                        return (
                          <Link key={v.id} href={`/vendors/${v.id}`}>
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{v.name}</p>
                                    {v.category && (
                                      <p className="text-xs text-muted-foreground truncate">{v.category}</p>
                                    )}
                                  </div>
                                  {score != null && (
                                    <span className={cn(
                                      "font-mono text-sm font-bold shrink-0",
                                      score >= 8 ? "text-red-600" : score >= 5 ? "text-amber-600" : "text-emerald-600"
                                    )}>
                                      {score}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2">
                                  <TierBadge tier={v.tier} />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
