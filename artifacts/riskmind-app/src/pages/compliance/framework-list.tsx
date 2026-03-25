import { useState } from "react";
import { useListFrameworks, useGetMe, type Framework } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ShieldCheck, ArrowRight, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ImportFrameworkDialog } from "@/components/compliance/import-framework-dialog";
import { CreateFrameworkDialog } from "@/components/compliance/create-framework-dialog";

// Extended Framework type with fields added in Plan 02 (not yet in generated Orval types)
type FrameworkWithCompliance = Framework & {
  compliancePercentage?: number | null;
  complianceThreshold?: number | null;
};

type ComplianceStatus = "COMPLIANT" | "AT-RISK" | "NON-COMPLIANT";

function deriveComplianceStatus(
  score: number | null | undefined,
  threshold: number | null | undefined
): ComplianceStatus | null {
  if (score == null || threshold == null) return null;
  if (score >= threshold) return "COMPLIANT";
  if (score >= threshold - 15) return "AT-RISK";
  return "NON-COMPLIANT";
}

const STATUS_BADGE: Record<ComplianceStatus, string> = {
  COMPLIANT: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300",
  "AT-RISK": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300",
  "NON-COMPLIANT": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300",
};

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  COMPLIANT: "Compliant",
  "AT-RISK": "At Risk",
  "NON-COMPLIANT": "Non-Compliant",
};

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "stroke-emerald-500" : score >= 50 ? "stroke-yellow-500" : "stroke-destructive";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-muted" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-sm font-bold font-mono">{score}%</span>
    </div>
  );
}

function FrameworkCard({
  fw,
  onImport,
  canEdit,
}: {
  fw: FrameworkWithCompliance;
  onImport: (id: string) => void;
  canEdit: boolean;
}) {
  const fwId = fw.id || "";
  const scoreValue = fw.compliancePercentage ?? 0;
  const status = deriveComplianceStatus(fw.compliancePercentage, fw.complianceThreshold);

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col overflow-hidden group">
      <div className="h-2 w-full bg-sidebar group-hover:bg-primary transition-colors" />
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-start gap-2">
          <span className="leading-tight">{fw.name}</span>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreRing score={scoreValue} />
            {status ? (
              <Badge
                variant="outline"
                className={cn("text-[10px] uppercase font-bold px-2 py-0.5", STATUS_BADGE[status])}
              >
                {STATUS_LABEL[status]}
              </Badge>
            ) : (
              <span className={cn("text-xs font-mono font-medium",
                scoreValue >= 80 ? "text-emerald-600" : scoreValue >= 50 ? "text-amber-600" : "text-destructive"
              )}>
                {scoreValue >= 80 ? "Compliant" : scoreValue >= 50 ? "Partial" : "At Risk"}
              </span>
            )}
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground font-mono pt-1">Version: {fw.version || '-'}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        <p className="text-sm text-foreground/80 line-clamp-2 my-4">
          {fw.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-4 border-t gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Added {format(new Date(fw.createdAt || ''), 'MMM yyyy')}</span>
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => { e.preventDefault(); onImport(fwId); }}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                Import
              </Button>
            )}
            <Link href={`/compliance/${fw.id}`}>
              <Button variant="ghost" size="sm" className="group-hover:bg-secondary">
                Analyze Gaps <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FrameworkList() {
  const { data: frameworks, isLoading } = useListFrameworks();
  const { data: user } = useGetMe({ query: { queryKey: ["/api/v1/auth/me"] } });
  const queryClient = useQueryClient();
  const canEdit = user?.role === "admin" || user?.role === "risk_manager";

  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>("");

  function handleImport(frameworkId: string) {
    setSelectedFrameworkId(frameworkId);
    setImportOpen(true);
  }

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ["/api/v1/compliance/frameworks"] });
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Compliance Frameworks</h1>
            <p className="text-muted-foreground mt-1">Map internal controls to standard regulatory requirements.</p>
          </div>
          {canEdit && (
            <div className="flex gap-3">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Framework
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
        ) : frameworks?.data?.length === 0 ? (
          <div className="text-center p-12 bg-card border rounded-xl shadow-sm text-muted-foreground">
            No frameworks loaded in the system.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(frameworks?.data as FrameworkWithCompliance[] | undefined)?.map((fw) => (
              <FrameworkCard
                key={fw.id}
                fw={fw}
                onImport={handleImport}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>

      <ImportFrameworkDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        frameworkId={selectedFrameworkId}
        onSuccess={handleSuccess}
      />

      <CreateFrameworkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}
