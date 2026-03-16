import { useState } from "react";
import { useRoute } from "wouter";
import { useGetVendor, useListQuestionnaires, useListDocuments, useCalculateVendorRiskScore, useTransitionVendor, useCreateDocument, useSummarizeVendorDocument } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/severity-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Mail, Loader2, FileText, ClipboardList, RefreshCw, Upload, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { VendorStatus } from "@workspace/api-client-react";

const LIFECYCLE_TRANSITIONS: Record<string, { label: string; target: VendorStatus }[]> = {
  onboarding: [{ label: "Approve Vendor", target: "approved" }],
  approved: [{ label: "Activate", target: "active" }],
  active: [{ label: "Suspend", target: "suspended" }, { label: "Start Offboarding", target: "offboarded" }],
  suspended: [{ label: "Reactivate", target: "active" }, { label: "Offboard", target: "offboarded" }],
};

export default function VendorDetail() {
  const [, params] = useRoute("/vendors/:id");
  const id = params?.id || "";
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docForm, setDocForm] = useState({ fileName: "", mimeType: "application/pdf" });
  const [summarizingDocs, setSummarizingDocs] = useState<Record<string, "pending" | "done">>({});

  const { data: vendor, isLoading } = useGetVendor(id);
  const { data: questionnaires } = useListQuestionnaires(id);
  const { data: documents } = useListDocuments(id);

  const calcMutation = useCalculateVendorRiskScore({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}`] })
    }
  });

  const transitionMutation = useTransitionVendor({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}`] })
    }
  });

  const uploadMutation = useCreateDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/vendors/${id}/documents`] });
        setUploadOpen(false);
        setDocForm({ fileName: "", mimeType: "application/pdf" });
      }
    }
  });

  const summarizeMutation = useSummarizeVendorDocument({
    mutation: {
      onSuccess: (_, vars) => {
        setSummarizingDocs((prev) => ({ ...prev, [vars.documentId]: "done" }));
      },
    },
  });

  if (isLoading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div></AppLayout>;
  if (!vendor) return <AppLayout><div className="p-8 text-center text-muted-foreground">Vendor not found</div></AppLayout>;

  const availableTransitions = vendor.status ? LIFECYCLE_TRANSITIONS[vendor.status] || [] : [];

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

                {availableTransitions.length > 0 && (
                  <div className="flex gap-2 pt-4 border-t">
                    {availableTransitions.map((t: { label: string; target: VendorStatus }) => (
                      <Button
                        key={t.target}
                        variant={t.target === "suspended" ? "destructive" : "default"}
                        size="sm"
                        disabled={transitionMutation.isPending}
                        onClick={() => transitionMutation.mutate({ id, data: { targetStatus: t.target } })}
                      >
                        {transitionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                        {t.label}
                      </Button>
                    ))}
                  </div>
                )}
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
                  <Button variant="outline" className="mt-4">Send Assessment</Button>
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
              <div className="p-4 border-b bg-muted/10 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Upload Document
                </Button>
              </div>
              {documents?.data?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p>No documents uploaded (SOC2, ISO27001, etc).</p>
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
                      <div className="flex items-center gap-2">
                        {summarizingDocs[doc.id!] === "done" ? (
                          <span className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Analysis queued
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={summarizeMutation.isPending || summarizingDocs[doc.id!] === "pending"}
                            onClick={() => {
                              if (!doc.id) return;
                              setSummarizingDocs((prev) => ({ ...prev, [doc.id!]: "pending" }));
                              summarizeMutation.mutate({ vendorId: id, documentId: doc.id });
                            }}
                          >
                            {summarizingDocs[doc.id!] === "pending" ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            AI Analysis
                          </Button>
                        )}
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent className="sm:max-w-md w-full border-l">
          <SheetHeader>
            <SheetTitle>Upload Document</SheetTitle>
            <SheetDescription>Add a compliance document for this vendor (SOC2, ISO 27001, etc).</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); uploadMutation.mutate({ vendorId: id, data: { fileName: docForm.fileName, mimeType: docForm.mimeType } }); }} className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input required value={docForm.fileName} onChange={e => setDocForm({...docForm, fileName: e.target.value})} placeholder="SOC2_Type_II_2025.pdf" />
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={docForm.mimeType} onValueChange={(v) => setDocForm({...docForm, mimeType: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="application/pdf">PDF</SelectItem>
                  <SelectItem value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">DOCX</SelectItem>
                  <SelectItem value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">XLSX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
