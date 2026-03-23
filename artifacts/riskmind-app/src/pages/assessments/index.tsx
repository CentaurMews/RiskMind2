import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Link } from "wouter";
import { format } from "date-fns";
import { getScoreTier } from "@/components/assessments/types";

// ─── API helpers ──────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("accessToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentListItem {
  id: string;
  status: "draft" | "active" | "completed" | "abandoned";
  contextType?: string | null;
  score?: { overall: number } | null;
  completedAt?: string | null;
  subjectName?: string | null;
  template?: { title?: string } | null;
}

interface AssessmentsListResponse {
  data: AssessmentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "outline" },
    active: { label: "In Progress", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    abandoned: { label: "Abandoned", variant: "destructive" },
  };
  const c = config[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

// ─── Filter buttons ───────────────────────────────────────────────────────────

function FilterGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === opt.value
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "in_progress" | "completed";
type TypeFilter = "all" | "vendor" | "compliance";

const PAGE_SIZE = 20;

export default function AssessmentList() {
  const [, setLocation] = useLocation();

  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const fetchAssessments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });

      if (statusFilter === "in_progress") {
        params.set("status", "active");
      } else if (statusFilter === "completed") {
        params.set("status", "completed");
      }

      if (typeFilter !== "all") {
        params.set("contextType", typeFilter);
      }

      const result = await apiGet<AssessmentsListResponse>(`/v1/assessments?${params.toString()}`);
      setAssessments(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch {
      setAssessments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAssessments();
  }, [page, statusFilter, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowClick = (assessment: AssessmentListItem) => {
    if (assessment.status === "completed") {
      setLocation(`/assessments/${assessment.id}/results`);
    } else {
      setLocation(`/assessments/${assessment.id}/session`);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isEmpty = !isLoading && assessments.length === 0;

  return (
    <AppLayout>
      <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Assessments</h1>
          <Button asChild>
            <Link href="/assessments/templates">New Assessment</Link>
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <FilterGroup<StatusFilter>
            options={[
              { label: "All", value: "all" },
              { label: "In Progress", value: "in_progress" },
              { label: "Completed", value: "completed" },
            ]}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
          />
          <FilterGroup<TypeFilter>
            options={[
              { label: "All", value: "all" },
              { label: "Vendor", value: "vendor" },
              { label: "Compliance", value: "compliance" },
            ]}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
          />
        </div>

        {/* Table */}
        {isEmpty ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No assessments yet</EmptyTitle>
              <EmptyDescription>
                Start by selecting a template from the library and assigning it to a vendor or compliance framework.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/assessments/templates">Browse Templates</Link>
            </Button>
          </Empty>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Overall Score</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <SkeletonRows />
                  ) : (
                    assessments.map((assessment) => {
                      const tier = assessment.score
                        ? getScoreTier(assessment.score.overall)
                        : null;
                      return (
                        <TableRow
                          key={assessment.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(assessment)}
                        >
                          <TableCell className="font-medium">
                            {assessment.subjectName ?? `Assessment ${assessment.id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {assessment.template?.title ?? "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={assessment.status} />
                          </TableCell>
                          <TableCell>
                            {assessment.score && tier ? (
                              <span className={`font-medium ${tier.className}`}>
                                {Math.round(assessment.score.overall)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {assessment.completedAt
                              ? format(new Date(assessment.completedAt), "MMM d, yyyy")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-4 py-2 text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-disabled={page === totalPages}
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
