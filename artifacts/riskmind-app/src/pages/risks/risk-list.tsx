import { useState } from "react";
import { Link } from "wouter";
import { useListRisks, useCreateRisk, type RiskCategory } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge, StatusBadge } from "@/components/ui/severity-badge";
import { Plus, Search, Filter, Loader2, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function RiskList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListRisks({ search: search || undefined });
  const queryClient = useQueryClient();
  const createMutation = useCreateRisk({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
        setIsOpen(false);
      }
    }
  });

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "operational" as RiskCategory,
    likelihood: "3",
    impact: "3"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        likelihood: parseInt(formData.likelihood),
        impact: parseInt(formData.impact),
      }
    });
  };

  const computeSeverity = (l?: number, i?: number) => {
    if (!l || !i) return 'unknown';
    const score = l * i;
    if (score >= 15) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Risk Register</h1>
            <p className="text-muted-foreground mt-1">Manage and track enterprise risks across all domains.</p>
          </div>
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button className="shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Create Risk
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md w-full border-l overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Create New Risk</SheetTitle>
                <SheetDescription>Log a new risk into the enterprise register.</SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Data Breach via Third-Party" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea 
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-y" 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as typeof formData.category})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="strategic">Strategic</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Likelihood (1-5)</Label>
                    <Input type="number" min="1" max="5" required value={formData.likelihood} onChange={e => setFormData({...formData, likelihood: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Impact (1-5)</Label>
                    <Input type="number" min="1" max="5" required value={formData.impact} onChange={e => setFormData({...formData, impact: e.target.value})} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                  Save Risk
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-card flex items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search risks..." 
                className="pl-9 bg-muted/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" /> Filter
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No risks found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((risk) => (
                    <TableRow key={risk.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{risk.id?.split('-')[0]}</TableCell>
                      <TableCell className="font-medium">{risk.title}</TableCell>
                      <TableCell className="capitalize">{risk.category}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={computeSeverity(risk.likelihood, risk.impact)} />
                        <span className="text-xs text-muted-foreground ml-2 font-mono hidden lg:inline">
                          ({risk.likelihood}×{risk.impact})
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge status={risk.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(risk.createdAt || ''), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/risks/${risk.id}`}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
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
