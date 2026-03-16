import { useListFindings } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/severity-badge";
import { GitMerge, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function FindingList() {
  const { data, isLoading } = useListFindings();

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
                  <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No active findings.</TableCell></TableRow>
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
      </div>
    </AppLayout>
  );
}
