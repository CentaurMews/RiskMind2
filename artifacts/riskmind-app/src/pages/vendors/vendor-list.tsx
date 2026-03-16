import { useState } from "react";
import { Link } from "wouter";
import { useListVendors, useCreateVendor, type VendorTier } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/severity-badge";
import { Plus, Search, Building2, Loader2, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

export default function VendorList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListVendors({ search: search || undefined });
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    tier: "medium" as VendorTier,
    contactEmail: ""
  });

  const createMutation = useCreateVendor({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/vendors"] });
        setIsOpen(false);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ data: formData });
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Third-Party Risk</h1>
            <p className="text-muted-foreground mt-1">Manage vendor lifecycle and compliance.</p>
          </div>
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button className="shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md w-full border-l">
              <SheetHeader>
                <SheetTitle>Register New Vendor</SheetTitle>
                <SheetDescription>Initiate TPRM onboarding process.</SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Cloud Hosting" />
                </div>
                <div className="space-y-2">
                  <Label>Criticality Tier</Label>
                  <Select value={formData.tier} onValueChange={(v: any) => setFormData({...formData, tier: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Primary Contact Email</Label>
                  <Input type="email" value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} placeholder="security@acme.com" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                  Register Vendor
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 shadow-sm">
          <div className="p-4 border-b bg-card flex items-center gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search vendors..." 
                className="pl-9 bg-muted/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No vendors found.</TableCell></TableRow>
                ) : (
                  data?.data?.map((vendor) => (
                    <TableRow key={vendor.id} className="group hover:bg-muted/30 cursor-pointer">
                      <TableCell className="font-medium flex items-center">
                        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center mr-3 border">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {vendor.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{vendor.category || '-'}</TableCell>
                      <TableCell className="capitalize text-sm">{vendor.tier}</TableCell>
                      <TableCell><StatusBadge status={vendor.status} /></TableCell>
                      <TableCell>
                        {vendor.riskScore ? (
                          <div className="flex items-center gap-2">
                            <div className="font-mono font-bold">{vendor.riskScore}</div>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (Number(vendor.riskScore)/10)*100)}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-muted-foreground text-xs italic">Pending</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/vendors/${vendor.id}`}>
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
