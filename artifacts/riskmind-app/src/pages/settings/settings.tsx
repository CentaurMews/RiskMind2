import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetMe,
  useListLlmProviders,
  useGetAgentConfig,
  useListUsers,
  useUpdateUserRole,
  useCreateLlmProvider,
  useUpdateLlmProvider,
  useDeleteLlmProvider,
  useTestLlmProvider,
  useListAgentRuns,
  useTriggerAgentRun,
  useUpdateAgentConfig,
  useListAgentFindings,
  useCreateRiskFromFinding,
  useApproveAgentFinding,
  useDismissAgentFinding,
  useGetEmbeddingsHealth,
  useDiscoverLlmModels,
} from "@workspace/api-client-react";
import type { UpdateUserRoleBodyRole, LlmProvider, CreateLlmProvider, UpdateLlmProvider, AgentFinding } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert, Bot, Server, Loader2, Users, Shield,
  Plus, Pencil, Trash2, CheckCircle2, XCircle,
  Play, RefreshCw, Clock, AlertTriangle, Eye,
  Link2, Zap, TrendingUp, Search, Lightbulb, Ban, X
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

const ROLES: { value: UpdateUserRoleBodyRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "risk_manager", label: "Risk Manager" },
  { value: "risk_owner", label: "Risk Owner" },
  { value: "auditor", label: "Auditor" },
  { value: "viewer", label: "Viewer" },
  { value: "vendor", label: "Vendor" },
];

const POLICY_TIERS = [
  { value: "observe", label: "Observe — monitor only, no actions", desc: "Agent watches, logs, and reports. Never modifies data." },
  { value: "advisory", label: "Advisory — suggest but require approval", desc: "Agent raises findings that humans approve before action." },
  { value: "active", label: "Active — autonomous execution", desc: "Agent acts autonomously within defined policy boundaries." },
];

type LlmProviderForm = {
  name: string;
  providerType: "openai_compat" | "anthropic";
  model: string;
  baseUrl: string;
  apiKey: string;
  useCase: string;
  isDefault: boolean;
};

const EMPTY_PROVIDER_FORM: LlmProviderForm = {
  name: "",
  providerType: "openai_compat",
  model: "",
  baseUrl: "",
  apiKey: "",
  useCase: "general",
  isDefault: false,
};

function RunStatusBadge({ status }: { status?: string }) {
  if (status === "completed") return <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
  if (status === "failed") return <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
  if (status === "running") return <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
  return <Badge variant="outline" className="text-muted-foreground"><Clock className="h-3 w-3 mr-1" />{status || "Unknown"}</Badge>;
}

const FINDING_TYPE_CONFIG: Record<string, { icon: typeof Link2; label: string; color: string }> = {
  cascade_chain: { icon: Link2, label: "Cascade Chain", color: "text-orange-700 border-orange-200 bg-orange-50" },
  cluster: { icon: Zap, label: "Cluster", color: "text-purple-700 border-purple-200 bg-purple-50" },
  predictive_signal: { icon: TrendingUp, label: "Predictive", color: "text-blue-700 border-blue-200 bg-blue-50" },
  anomaly: { icon: Search, label: "Anomaly", color: "text-red-700 border-red-200 bg-red-50" },
  cross_domain: { icon: Zap, label: "Cross-Domain", color: "text-indigo-700 border-indigo-200 bg-indigo-50" },
  recommendation: { icon: Lightbulb, label: "Recommendation", color: "text-emerald-700 border-emerald-200 bg-emerald-50" },
};

function FindingTypeBadge({ type }: { type?: string }) {
  const config = FINDING_TYPE_CONFIG[type || ""] || { icon: AlertTriangle, label: type || "Unknown", color: "text-muted-foreground" };
  const Icon = config.icon;
  return <Badge variant="outline" className={config.color}><Icon className="h-3 w-3 mr-1" />{config.label}</Badge>;
}

function FindingStatusBadge({ status }: { status?: string }) {
  if (status === "pending_review") return <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  if (status === "actioned") return <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-3 w-3 mr-1" />Actioned</Badge>;
  if (status === "dismissed") return <Badge variant="outline" className="text-muted-foreground"><Ban className="h-3 w-3 mr-1" />Dismissed</Badge>;
  if (status === "acknowledged") return <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50"><Eye className="h-3 w-3 mr-1" />Acknowledged</Badge>;
  return <Badge variant="outline">{status || "Unknown"}</Badge>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-700 border-red-200 bg-red-50",
  high: "text-orange-700 border-orange-200 bg-orange-50",
  medium: "text-amber-700 border-amber-200 bg-amber-50",
  low: "text-blue-700 border-blue-200 bg-blue-50",
  info: "text-muted-foreground",
};

export default function Settings() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: providers, isLoading: providersLoading } = useListLlmProviders();
  const { data: agentConfig, isLoading: agentLoading } = useGetAgentConfig();
  const { data: usersList, isLoading: usersLoading } = useListUsers({ query: { queryKey: ["/api/v1/users"], retry: false } });
  const { data: agentRuns } = useListAgentRuns({ limit: 10 }, { query: { queryKey: ["/api/v1/agent/runs"] } });
  const { data: agentFindings, isLoading: findingsLoading } = useListAgentFindings({ limit: 20 }, { query: { queryKey: ["/api/v1/agent/findings"] } });
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: embeddingsHealth } = useGetEmbeddingsHealth({
    query: { queryKey: ["/api/v1/settings/embeddings-health"] }
  });
  const [embeddingsBannerDismissed, setEmbeddingsBannerDismissed] = useState(false);

  const [providerSheet, setProviderSheet] = useState<"closed" | "add" | "edit">("closed");
  const [editingProvider, setEditingProvider] = useState<LlmProvider | null>(null);
  const [providerForm, setProviderForm] = useState<LlmProviderForm>(EMPTY_PROVIDER_FORM);
  const [testResult, setTestResult] = useState<Record<string, "ok" | "fail" | "testing">>({});
  const [discoveredModelsForForm, setDiscoveredModelsForForm] = useState<{ id: string; displayName?: string }[]>([]);

  const [agentForm, setAgentForm] = useState<{
    enabled?: boolean;
    policyTier?: string;
    schedule?: string;
  }>({});

  const roleUpdateMutation = useUpdateUserRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      },
    },
  });

  const createProviderMutation = useCreateLlmProvider({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-providers"] });
        setProviderSheet("closed");
        setProviderForm(EMPTY_PROVIDER_FORM);
      },
    },
  });

  const updateProviderMutation = useUpdateLlmProvider({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-providers"] });
        setProviderSheet("closed");
        setEditingProvider(null);
      },
    },
  });

  const deleteProviderMutation = useDeleteLlmProvider({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-providers"] });
      },
    },
  });

  const testProviderMutation = useTestLlmProvider({
    mutation: {
      onSuccess: (_, vars) => {
        setTestResult((prev) => ({ ...prev, [vars.id]: "ok" }));
        setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[vars.id]; return n; }), 4000);
      },
      onError: (_, vars) => {
        setTestResult((prev) => ({ ...prev, [vars.id]: "fail" }));
        setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[vars.id]; return n; }), 4000);
      },
    },
  });

  const discoverModelsMutation = useDiscoverLlmModels({
    mutation: {
      onSuccess: (data) => {
        const models = Array.isArray((data as { models?: { id: string; displayName?: string }[] })?.models)
          ? (data as { models: { id: string; displayName?: string }[] }).models
          : [];
        setDiscoveredModelsForForm(models);
      },
    },
  });

  const updateAgentMutation = useUpdateAgentConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/config"] });
        setAgentForm({});
      },
    },
  });

  const triggerRunMutation = useTriggerAgentRun({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/runs"] });
      },
    },
  });

  const createRiskFromFindingMutation = useCreateRiskFromFinding({
    mutation: {
      onSuccess: (data: { risk?: { id?: string } }) => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/findings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
        if (data?.risk?.id) {
          navigate(`/risks/${data.risk.id}`);
        }
      },
    },
  });

  const approveFindingMutation = useApproveAgentFinding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/findings"] });
      },
    },
  });

  const dismissFindingMutation = useDismissAgentFinding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/findings"] });
      },
    },
  });

  if (userLoading) {
    return (
      <AppLayout>
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      </AppLayout>
    );
  }

  if (user?.role !== "admin") {
    return (
      <AppLayout>
        <div className="p-12 text-center h-full flex flex-col justify-center items-center">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">Only administrators can access tenant settings.</p>
          <Link href="/dashboard"><Button variant="outline" className="mt-6">Return to Dashboard</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const users = Array.isArray(usersList) ? usersList : [];
  const providerList: LlmProvider[] = providers || [];
  const runList = agentRuns?.data || [];
  const findingList: AgentFinding[] = agentFindings?.data || [];

  const openAddProvider = () => {
    setProviderForm(EMPTY_PROVIDER_FORM);
    setEditingProvider(null);
    setDiscoveredModelsForForm([]);
    setProviderSheet("add");
  };

  const openEditProvider = (p: LlmProvider) => {
    setProviderForm({
      name: p.name || "",
      providerType: (p.providerType as "openai_compat" | "anthropic") || "openai_compat",
      model: p.model || "",
      baseUrl: (p as { baseUrl?: string }).baseUrl || "",
      apiKey: "",
      useCase: p.useCase || "general",
      isDefault: p.isDefault || false,
    });
    setEditingProvider(p);
    setDiscoveredModelsForForm([]);
    setProviderSheet("edit");
  };

  const handleProviderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: providerForm.name,
      providerType: providerForm.providerType,
      model: providerForm.model,
      baseUrl: providerForm.baseUrl || undefined,
      apiKey: providerForm.apiKey || undefined,
      useCase: providerForm.useCase,
      isDefault: providerForm.isDefault,
    };

    if (providerSheet === "add") {
      createProviderMutation.mutate({ data: payload as CreateLlmProvider });
    } else if (editingProvider?.id) {
      updateProviderMutation.mutate({ id: editingProvider.id, data: payload as UpdateLlmProvider });
    }
  };

  const handleAgentSave = () => {
    if (Object.keys(agentForm).length === 0) return;
    updateAgentMutation.mutate({ data: agentForm as { enabled?: boolean; policyTier?: "observe" | "advisory" | "active"; schedule?: string } });
  };

  const effectiveAgent = {
    enabled: agentForm.enabled ?? agentConfig?.enabled ?? true,
    policyTier: agentForm.policyTier ?? agentConfig?.policyTier ?? "observe",
    schedule: agentForm.schedule ?? agentConfig?.schedule ?? "0 6 * * *",
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Settings</h1>
          <p className="text-muted-foreground mt-1">Manage AI, agents, users, and providers for your organization.</p>
        </div>

        {embeddingsHealth && !(embeddingsHealth as { configured?: boolean }).configured && !embeddingsBannerDismissed && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 mb-6">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1 text-sm">
              <span className="font-medium">No embeddings provider configured.</span>{" "}
              Semantic search, agent clustering, and signal correlation are degraded.
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-0.5 -mr-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
              onClick={() => setEmbeddingsBannerDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Tabs defaultValue="llm" className="w-full">
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger value="llm" className="data-[state=active]:shadow-sm rounded-md">
              <Server className="h-4 w-4 mr-2" /> LLM Providers
            </TabsTrigger>
            <TabsTrigger value="agent" className="data-[state=active]:shadow-sm rounded-md">
              <Bot className="h-4 w-4 mr-2" /> Agent Config
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:shadow-sm rounded-md">
              <Users className="h-4 w-4 mr-2" /> Users & Roles
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">

            {/* LLM PROVIDERS TAB */}
            <TabsContent value="llm" className="m-0 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center"><Server className="h-5 w-5 mr-2" /> LLM Providers</CardTitle>
                    <CardDescription className="mt-1">Configure language models used by AI features. The default provider is used for all AI operations.</CardDescription>
                  </div>
                  <Button onClick={openAddProvider} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Provider
                  </Button>
                </CardHeader>
                <CardContent>
                  {providersLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                  ) : providerList.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl space-y-3">
                      <Server className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                      <div>
                        <p className="font-medium">No LLM providers configured</p>
                        <p className="text-sm text-muted-foreground mt-1">Add a provider to enable AI features across the platform — risk interviews, signal triage, gap analysis, and more.</p>
                      </div>
                      <Button onClick={openAddProvider} variant="outline">
                        <Plus className="h-4 w-4 mr-2" /> Add your first provider
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {providerList.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/20 transition-colors">
                          <div className="space-y-1">
                            <div className="font-semibold flex items-center gap-2">
                              {p.name}
                              {p.isDefault && (
                                <Badge className="text-[10px] uppercase font-bold tracking-wider h-4 px-1.5">Default</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {p.model} &bull; {p.providerType} &bull; {p.useCase || "general"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {testResult[p.id!] === "testing" && (
                              <Badge variant="outline" className="text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing</Badge>
                            )}
                            {testResult[p.id!] === "ok" && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>
                            )}
                            {testResult[p.id!] === "fail" && (
                              <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={testResult[p.id!] === "testing"}
                              onClick={() => {
                                if (!p.id) return;
                                setTestResult((prev) => ({ ...prev, [p.id!]: "testing" }));
                                testProviderMutation.mutate({ id: p.id });
                              }}
                            >
                              <Play className="h-3 w-3 mr-1" /> Test
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProvider(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => p.id && deleteProviderMutation.mutate({ id: p.id })}
                              disabled={deleteProviderMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/10 bg-muted/5">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Supported Provider Types</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="font-mono text-xs font-bold">openai_compat</div>
                    <p className="text-muted-foreground text-xs">OpenAI, Azure OpenAI, Groq, Together AI, Ollama, LM Studio, or any OpenAI-compatible endpoint. Set Base URL for non-OpenAI.</p>
                  </div>
                  <div className="space-y-1">
                    <div className="font-mono text-xs font-bold">anthropic</div>
                    <p className="text-muted-foreground text-xs">Anthropic Claude (claude-3-5-sonnet, claude-3-opus, etc). Requires an Anthropic API key.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AGENT CONFIG TAB */}
            <TabsContent value="agent" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Autonomous Risk Intelligence Agent</CardTitle>
                  <CardDescription>Configure how the AI agent monitors your risk landscape, when it runs, and how much autonomy it has.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {agentLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between py-3 border-b">
                        <div>
                          <div className="font-medium">Agent Enabled</div>
                          <div className="text-sm text-muted-foreground">Master switch for scheduled autonomous runs</div>
                        </div>
                        <Switch
                          checked={effectiveAgent.enabled}
                          onCheckedChange={(v) => setAgentForm((prev) => ({ ...prev, enabled: v }))}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Policy Tier</Label>
                        <p className="text-xs text-muted-foreground">Controls how much autonomy the agent has when it acts on findings.</p>
                        <div className="space-y-2">
                          {POLICY_TIERS.map((tier) => (
                            <button
                              key={tier.value}
                              type="button"
                              onClick={() => setAgentForm((prev) => ({ ...prev, policyTier: tier.value }))}
                              className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                                effectiveAgent.policyTier === tier.value
                                  ? "border-foreground bg-foreground/5 font-medium"
                                  : "border-border hover:bg-muted/50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {effectiveAgent.policyTier === tier.value ? (
                                  <Eye className="h-4 w-4 shrink-0" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border shrink-0" />
                                )}
                                <div>
                                  <div className="font-medium">{tier.label}</div>
                                  <div className="text-xs text-muted-foreground font-normal mt-0.5">{tier.desc}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Schedule (cron)</Label>
                        <p className="text-xs text-muted-foreground">When the agent runs automatically. Uses standard 5-field cron syntax.</p>
                        <Input
                          value={effectiveAgent.schedule}
                          onChange={(e) => setAgentForm((prev) => ({ ...prev, schedule: e.target.value }))}
                          placeholder="0 6 * * *"
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Examples: <span className="font-mono">0 6 * * *</span> (daily 6am) · <span className="font-mono">0 */4 * * *</span> (every 4h) · <span className="font-mono">0 9 * * 1</span> (weekly Mon 9am)
                        </p>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={handleAgentSave}
                          disabled={updateAgentMutation.isPending || Object.keys(agentForm).length === 0}
                        >
                          {updateAgentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Save Configuration
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => triggerRunMutation.mutate()}
                          disabled={triggerRunMutation.isPending}
                        >
                          {triggerRunMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Run Now
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Recent Agent Runs</CardTitle>
                    <CardDescription>Last 10 autonomous agent execution cycles.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/runs"] })}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {runList.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      No agent runs recorded. Click "Run Now" to trigger a manual cycle.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Policy</TableHead>
                          <TableHead>Findings</TableHead>
                          <TableHead>Actions</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runList.map((run) => {
                          const started = run.createdAt ? new Date(run.createdAt) : null;
                          const ended = (run as { completedAt?: string }).completedAt ? new Date((run as { completedAt: string }).completedAt) : null;
                          const durationMs = started && ended ? ended.getTime() - started.getTime() : null;
                          return (
                            <TableRow key={run.id}>
                              <TableCell><RunStatusBadge status={run.status} /></TableCell>
                              <TableCell className="text-xs font-mono capitalize">{run.policyTier}</TableCell>
                              <TableCell className="text-xs">{(run as { findingsCount?: number }).findingsCount ?? 0}</TableCell>
                              <TableCell className="text-xs">{(run as { actionsCount?: number }).actionsCount ?? 0}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{started ? format(started, "MMM d, HH:mm") : "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono">
                                {durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Agent Findings</CardTitle>
                    <CardDescription>Intelligence findings from agent analysis — cascade chains, clusters, predictive signals, and more.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/findings"] })}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {findingsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                  ) : findingList.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Search className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      No findings yet. Agent findings will appear here after running an analysis cycle.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {findingList.map((finding) => {
                        const proposedAction = finding.proposedAction as Record<string, unknown> | null;
                        const hasCreateRisk = proposedAction?.type === "create_risk";
                        const isPending = finding.status === "pending_review";
                        return (
                          <div key={finding.id} className="border rounded-xl p-4 space-y-2 hover:bg-muted/20 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <FindingTypeBadge type={finding.type} />
                                  <Badge variant="outline" className={SEVERITY_COLORS[finding.severity || "medium"]}>{finding.severity}</Badge>
                                  <FindingStatusBadge status={finding.status} />
                                </div>
                                <div className="font-medium text-sm mt-1">{finding.title}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">{finding.narrative}</div>
                              </div>
                              {isPending && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {hasCreateRisk && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-7 text-xs"
                                      disabled={createRiskFromFindingMutation.isPending}
                                      onClick={() => finding.id && createRiskFromFindingMutation.mutate({ id: finding.id })}
                                    >
                                      {createRiskFromFindingMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <Plus className="h-3 w-3 mr-1" />
                                      )}
                                      Create Risk
                                    </Button>
                                  )}
                                  {!hasCreateRisk && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      disabled={approveFindingMutation.isPending}
                                      onClick={() => finding.id && approveFindingMutation.mutate({ id: finding.id })}
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Approve
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-muted-foreground"
                                    disabled={dismissFindingMutation.isPending}
                                    onClick={() => finding.id && dismissFindingMutation.mutate({ id: finding.id, data: { reason: "Dismissed from settings" } })}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    Dismiss
                                  </Button>
                                </div>
                              )}
                              {finding.status === "actioned" && (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 shrink-0">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Actioned
                                </Badge>
                              )}
                              {finding.status === "dismissed" && (
                                <span className="text-xs text-muted-foreground shrink-0">{finding.dismissedReason || "Dismissed"}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* USERS TAB */}
            <TabsContent value="users" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Users className="h-5 w-5 mr-2" /> User Management</CardTitle>
                  <CardDescription>View and manage user accounts and role assignments.</CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No users found.</div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold border">
                                  {u.email.charAt(0).toUpperCase()}
                                </div>
                                {u.email}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{u.name || "-"}</TableCell>
                            <TableCell>
                              {u.id === user.id ? (
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="capitalize text-sm font-mono">{u.role.replace("_", " ")}</span>
                                  <span className="text-[10px] text-muted-foreground">(you)</span>
                                </div>
                              ) : (
                                <Select
                                  value={u.role}
                                  onValueChange={(newRole) => {
                                    roleUpdateMutation.mutate({ id: u.id, data: { role: newRole as UpdateUserRoleBodyRole } });
                                  }}
                                >
                                  <SelectTrigger className="w-[160px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLES.map((r) => (
                                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* ADD / EDIT PROVIDER SHEET */}
      <Sheet open={providerSheet !== "closed"} onOpenChange={(o) => { if (!o) { setProviderSheet("closed"); setEditingProvider(null); } }}>
        <SheetContent className="sm:max-w-md w-full border-l overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{providerSheet === "add" ? "Add LLM Provider" : "Edit LLM Provider"}</SheetTitle>
            <SheetDescription>
              {providerSheet === "add"
                ? "Connect a language model provider to enable AI features."
                : "Update the configuration for this provider."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleProviderSubmit} className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                required
                placeholder="e.g. GPT-4o Production"
                value={providerForm.name}
                onChange={(e) => setProviderForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Provider Type</Label>
              <Select
                value={providerForm.providerType}
                onValueChange={(v) => setProviderForm((prev) => ({ ...prev, providerType: v as "openai_compat" | "anthropic" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai_compat">openai_compat — OpenAI, Groq, Ollama, etc.</SelectItem>
                  <SelectItem value="anthropic">anthropic — Anthropic Claude</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Model</Label>
                {providerSheet === "edit" && editingProvider?.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    disabled={discoverModelsMutation.isPending}
                    onClick={() => discoverModelsMutation.mutate({ id: editingProvider.id! })}
                  >
                    {discoverModelsMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Load models
                  </Button>
                )}
              </div>
              {discoveredModelsForForm.length > 0 ? (
                <Select
                  value={providerForm.model}
                  onValueChange={(v) => setProviderForm((prev) => ({ ...prev, model: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {discoveredModelsForForm.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.displayName || m.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  required
                  placeholder={providerForm.providerType === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o"}
                  value={providerForm.model}
                  onChange={(e) => setProviderForm((prev) => ({ ...prev, model: e.target.value }))}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {providerForm.providerType === "anthropic"
                  ? "claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307"
                  : "gpt-4o, gpt-4o-mini, gpt-4-turbo, mistral-7b, llama-3-70b, etc."}
              </p>
            </div>

            {providerForm.providerType === "openai_compat" && (
              <div className="space-y-1.5">
                <Label>Base URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="https://api.openai.com/v1  or  http://localhost:11434"
                  value={providerForm.baseUrl}
                  onChange={(e) => setProviderForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Leave blank for OpenAI. Set to your Ollama, LM Studio, or Azure OpenAI endpoint.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>API Key {providerSheet === "edit" && <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span>}</Label>
              <Input
                type="password"
                placeholder={providerSheet === "edit" ? "••••••••  (unchanged)" : "sk-..."}
                value={providerForm.apiKey}
                onChange={(e) => setProviderForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Use Case</Label>
              <Select
                value={providerForm.useCase}
                onValueChange={(v) => setProviderForm((prev) => ({ ...prev, useCase: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General — all AI features</SelectItem>
                  <SelectItem value="enrichment">Enrichment — risk & vendor analysis</SelectItem>
                  <SelectItem value="triage">Triage — signal classification</SelectItem>
                  <SelectItem value="interviews">Interviews — guided AI conversations</SelectItem>
                  <SelectItem value="agent">Agent — autonomous risk agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Switch
                checked={providerForm.isDefault}
                onCheckedChange={(v) => setProviderForm((prev) => ({ ...prev, isDefault: v }))}
              />
              <div>
                <div className="text-sm font-medium">Set as default provider</div>
                <div className="text-xs text-muted-foreground">Used for all AI operations unless a specific use-case provider is configured.</div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createProviderMutation.isPending || updateProviderMutation.isPending}
            >
              {(createProviderMutation.isPending || updateProviderMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {providerSheet === "add" ? "Add Provider" : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
