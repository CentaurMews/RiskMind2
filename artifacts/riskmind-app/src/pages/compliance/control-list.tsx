import { useState } from "react";
import { useListControls, useCreateControl, useListFrameworks, useMapControlRequirements } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/severity-badge";
import { Plus, Search, Loader2, Shield, Link2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export default function ControlList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListControls();
  const { data: frameworks } = useListFrameworks();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "" });
  const [mappingControlId, setMappingControlId] = useState<string | null>(null);

  const createMutation = useCreateControl({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/controls"] });
        setIsOpen(false);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    }
  });

  const mapMutation = useMapControlRequirements({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/controls"] });
        setMappingControlId(null);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ 
      data: { 
        title: formData.title, 
        description: formData.description,
        status: "planned" 
      } 
    });
  };

  const handleAutoMap = (controlId: string) => {
    setMappingControlId(controlId);
    mapMutation.mutate({ id: controlId, data: { requirementIds: [] } });
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Internal Controls</h1>
            <p className="text-muted-foreground mt-1">Library of organizational controls mapped to compliance frameworks.</p>
          </div>
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button className="shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Create Control
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md w-full border-l">
              <SheetHeader>
                <SheetTitle>Define New Control</SheetTitle>
                <SheetDescription>Add a new internal control to the library.</SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Control Title</Label>
                  <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Mandatory MFA" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea 
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-y" 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                  Save Control
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
                placeholder="Search controls..." 
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
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Control Definition</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[150px]">Mapping</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No controls defined.</TableCell></TableRow>
                ) : (
                  data?.data?.filter(c => c.title?.toLowerCase().includes(search.toLowerCase())).map((control) => (
                    <TableRow key={control.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">CTRL-{control.id?.split('-')[0]}</TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2 mb-1"><Shield className="h-4 w-4 text-muted-foreground"/> {control.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xl">{control.description}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={control.status} /></TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          disabled={mapMutation.isPending && mappingControlId === control.id}
                          onClick={() => control.id && handleAutoMap(control.id)}
                        >
                          {mapMutation.isPending && mappingControlId === control.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Link2 className="h-3 w-3 mr-1" />
                          )}
                          Auto-Map
                        </Button>
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
