import { useRoute } from "wouter";
import { useGetVendor, useListQuestionnaires, useListDocuments, useCalculateVendorRiskScore } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/severity-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Mail, Loader2, FileText, ClipboardList, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function VendorDetail() {
  const [, params] = useRoute("/vendors/:id");
  const id = params?.id || "";
  const queryClient = useQueryClient();

  const { data: vendor, isLoading } = useGetVendor(id);
  const { data: questionnaires } = useListQuestionnaires(id);
  const { data: documents } = useListDocuments(id);

  const calcMutation = useCalculateVendorRiskScore({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}`] })
    }
  });

  if (isLoading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div></AppLayout>;
  if (!vendor) return <AppLayout><div className="p-8 text-center text-muted-foreground">Vendor not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center space-x-4 mb-4">
          <Link href="/vendors">
            <Button variant="outline" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="font-mono text-sm text-muted-foreground">VND-{vendor.id?.split('-')[0].toUpperCase()}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm border-t-4 border-t-sidebar">
            <CardContent className="p-8 flex flex-col md:flex-row gap-6 items-start">
              <div className="h-24 w-24 rounded-xl bg-secondary flex items-center justify-center shrink-0 border-2 border-border shadow-sm">
                <Building2 className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold tracking-tight">{vendor.name}</h1>
                  <StatusBadge status={vendor.status} />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /> {vendor.contactEmail || "No contact email"}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 bg-muted/30 p-4 rounded-lg border">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Category</span>
                    <div className="font-medium mt-1">{vendor.category || "Uncategorized"}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Criticality Tier</span>
                    <div className="font-medium mt-1 capitalize">{vendor.tier}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="flex items-center justify-between">
                Risk Score
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => calcMutation.mutate({ id })}
                  disabled={calcMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${calcMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-8">
              {vendor.riskScore ? (
                <>
                  <div className="text-6xl font-bold font-mono tracking-tighter">{vendor.riskScore}</div>
                  <span className="text-sm text-muted-foreground mt-2">/ 10.0</span>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <span className="text-2xl font-bold block mb-2">-</span>
                  <span className="text-xs">Awaiting data to calculate</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="questionnaires" className="w-full mt-8">
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger value="questionnaires" className="data-[state=active]:shadow-sm rounded-md"><ClipboardList className="h-4 w-4 mr-2" /> Questionnaires</TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:shadow-sm rounded-md"><FileText className="h-4 w-4 mr-2" /> Documents</TabsTrigger>
          </TabsList>
          
          <div className="mt-6 bg-card border rounded-xl overflow-hidden shadow-sm min-h-[300px]">
            <TabsContent value="questionnaires" className="p-0 m-0 border-none outline-none">
              {questionnaires?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p>No assessments sent to this vendor.</p>
                  <Button variant="outline" className="mt-4 mt-4">Send Assessment</Button>
                </div>
              ) : (
                <div className="divide-y">
                  {questionnaires?.data?.map(q => (
                    <div key={q.id} className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm mb-1">{q.title}</div>
                        <span className="text-xs text-muted-foreground font-mono">Last updated: {format(new Date(q.updatedAt || ''), 'MMM d, yyyy')}</span>
                      </div>
                      <StatusBadge status={q.status} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="documents" className="p-0 m-0 border-none outline-none">
               {documents?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p>No documents uploaded (SOC2, ISO27001, etc).</p>
                  <Button variant="outline" className="mt-4">Upload Document</Button>
                </div>
              ) : (
                <div className="divide-y">
                  {documents?.data?.map(doc => (
                    <div key={doc.id} className="p-4 hover:bg-muted/30 transition-colors flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded border"><FileText className="h-4 w-4" /></div>
                        <div>
                          <div className="font-semibold text-sm mb-1">{doc.fileName}</div>
                          <span className="text-xs text-muted-foreground">Type: {doc.mimeType?.split('/')[1] || 'unknown'}</span>
                        </div>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
