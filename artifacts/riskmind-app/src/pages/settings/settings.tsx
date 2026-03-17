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
  useProbeProvider,
  useProbeProviderById,
  VENDOR_BASE_URLS,
  type KnownVendor,
} from "@workspace/api-client-react";
import { OsintSourcesTab } from "./osint-sources-tab";
import type { UpdateUserRoleBodyRole, LlmProvider, CreateLlmProvider, UpdateLlmProvider, AgentFinding, LlmUseCase } from "@workspace/api-client-react";
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
  Link2, Zap, TrendingUp, Search, Lightbulb, Ban, Globe,
  ChevronRight, ChevronLeft, Gauge
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

function parseCronHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression";
  const [minute, hour, dom, month, dow] = parts;

  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const timeStr = (m: string, h: string): string => {
    if (/^\d+$/.test(m) && /^\d+$/.test(h)) {
      const hh = Number(h);
      const mm = Number(m);
      const period = hh >= 12 ? "PM" : "AM";
      const displayH = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      return `${displayH}:${mm.toString().padStart(2, "0")} ${period} UTC`;
    }
    if (m === "0" && h.startsWith("*/")) return `every ${h.slice(2)} hours`;
    if (m.startsWith("*/")) return `every ${m.slice(2)} minutes`;
    return `at minute ${m} of hour ${h}`;
  };

  if (minute === "*" && hour === "*") return "every minute";
  if (dom === "*" && month === "*" && dow === "*") {
    if (hour.startsWith("*/")) return `every ${hour.slice(2)} hours`;
    return `daily at ${timeStr(minute, hour)}`;
  }
  if (dom === "*" && month === "*" && dow !== "*") {
    const days = dow.split(",").map(d => dowNames[Number(d)] || d).join(", ");
    return `weekly on ${days} at ${timeStr(minute, hour)}`;
  }
  if (dom !== "*" && month === "*" && dow === "*") {
    return `monthly on day ${dom} at ${timeStr(minute, hour)}`;
  }
  return `cron: ${cron}`;
}

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

const VENDOR_OPTIONS: { key: KnownVendor; label: string }[] = [
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic (Claude)" },
  { key: "groq", label: "Groq" },
  { key: "mistral", label: "Mistral AI" },
  { key: "together", label: "Together AI" },
  { key: "cohere", label: "Cohere" },
  { key: "perplexity", label: "Perplexity" },
  { key: "ollama", label: "Ollama (local)" },
  { key: "lmstudio", label: "LM Studio (local)" },
  { key: "custom", label: "Custom endpoint" },
];

type WizardState = {
  step: 1 | 2 | 3 | 4;
  name: string;
  apiKey: string;
  vendor: KnownVendor | "";
  baseUrl: string;
  probeResult: { success: boolean; message: string; models: string[]; latencyMs: number; tokensPerSecond?: number } | null;
  selectedModel: string;
  modelSearch: string;
  useCase: string;
  isDefault: boolean;
};

const EMPTY_WIZARD: WizardState = {
  step: 1,
  name: "",
  apiKey: "",
  vendor: "",
  baseUrl: "",
  probeResult: null,
  selectedModel: "",
  modelSearch: "",
  useCase: "general",
  isDefault: false,
};

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

  const [providerSheet, setProviderSheet] = useState<"closed" | "add" | "edit">("closed");
  const [editingProvider, setEditingProvider] = useState<LlmProvider | null>(null);
  const [providerForm, setProviderForm] = useState<LlmProviderForm>(EMPTY_PROVIDER_FORM);
  const [testResult, setTestResult] = useState<Record<string, { status: "ok" | "fail" | "testing"; latencyMs?: number; message?: string }>>({});
  const [wizard, setWizard] = useState<WizardState>(EMPTY_WIZARD);

  const [editProbeResult, setEditProbeResult] = useState<{ success: boolean; message: string; models: string[]; latencyMs: number } | null>(null);
  const [editModelSearch, setEditModelSearch] = useState("");

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
        setWizard(EMPTY_WIZARD);
      },
    },
  });

  const updateProviderMutation = useUpdateLlmProvider({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-providers"] });
        setProviderSheet("closed");
        setEditingProvider(null);
        setEditProbeResult(null);
        setEditModelSearch("");
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
      onSuccess: (result, vars) => {
        const r = result as { success?: boolean; message?: string; latencyMs?: number };
        if (r.success === false) {
          setTestResult((prev) => ({ ...prev, [vars.id]: { status: "fail", message: r.message, latencyMs: r.latencyMs } }));
        } else {
          setTestResult((prev) => ({ ...prev, [vars.id]: { status: "ok", latencyMs: r.latencyMs } }));
        }
        setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[vars.id]; return n; }), 6000);
      },
      onError: (err, vars) => {
        const message = err instanceof Error ? err.message : String(err);
        setTestResult((prev) => ({ ...prev, [vars.id]: { status: "fail", message } }));
        setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[vars.id]; return n; }), 6000);
      },
    },
  });

  const probeMutation = useProbeProvider({
    mutation: {
      onSuccess: (result) => {
        setWizard((prev) => ({
          ...prev,
          probeResult: result,
          selectedModel: result.models[0] || "",
        }));
      },
    },
  });

  const editProbeMutation = useProbeProviderById({
    mutation: {
      onSuccess: (result) => {
        setEditProbeResult(result);
        if (result.success && result.models.length > 0) {
          const currentModel = providerForm.model;
          const modelInList = result.models.includes(currentModel);
          if (!modelInList && result.models[0]) {
            setProviderForm((prev) => ({ ...prev, model: result.models[0] }));
          }
        }
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
    setWizard(EMPTY_WIZARD);
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
    setEditProbeResult(null);
    setEditModelSearch("");
    setProviderSheet("edit");
  };

  const handleEditProviderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider?.id) return;
    const payload = {
      name: providerForm.name,
      providerType: providerForm.providerType,
      model: providerForm.model,
      baseUrl: providerForm.baseUrl || undefined,
      apiKey: providerForm.apiKey || undefined,
      useCase: providerForm.useCase,
      isDefault: providerForm.isDefault,
    };
    updateProviderMutation.mutate({ id: editingProvider.id, data: payload as UpdateLlmProvider });
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

  const wizardVendorInfo = wizard.vendor ? VENDOR_BASE_URLS[wizard.vendor] : null;
  const wizardProviderType = wizardVendorInfo?.providerType ?? "openai_compat";
  const wizardNeedsUrl = wizard.vendor === "ollama" || wizard.vendor === "lmstudio" || wizard.vendor === "custom";
  const wizardCanProbe = wizard.vendor !== "" && (wizardNeedsUrl ? wizard.baseUrl.trim() !== "" : true);

  const filteredModels = (wizard.probeResult?.models || []).filter((m) =>
    m.toLowerCase().includes(wizard.modelSearch.toLowerCase())
  );

  const editFilteredModels = (editProbeResult?.models || []).filter((m) =>
    m.toLowerCase().includes(editModelSearch.toLowerCase())
  );

  const handleWizardSave = () => {
    const vendor = wizard.vendor ? VENDOR_BASE_URLS[wizard.vendor] : null;
    const providerType = vendor?.providerType ?? "openai_compat";
    const baseUrl = wizardNeedsUrl ? wizard.baseUrl : (vendor?.baseUrl || "");
    const payload: CreateLlmProvider = {
      name: wizard.name,
      providerType,
      model: wizard.selectedModel,
      baseUrl: baseUrl || undefined,
      apiKey: wizard.apiKey || undefined,
      useCase: wizard.useCase as LlmUseCase,
      isDefault: wizard.isDefault,
    };
    createProviderMutation.mutate({ data: payload });
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Settings</h1>
          <p className="text-muted-foreground mt-1">Manage AI, agents, users, and providers for your organization.</p>
        </div>

        <Tabs defaultValue="llm" className="w-full">
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger value="llm" className="data-[state=active]:shadow-sm rounded-md">
              <Server className="h-4 w-4 mr-2" /> LLM Providers
            </TabsTrigger>
            <TabsTrigger value="agent" className="data-[state=active]:shadow-sm rounded-md">
              <Bot className="h-4 w-4 mr-2" /> Agent Config
            </TabsTrigger>
            <TabsTrigger value="sources" className="data-[state=active]:shadow-sm rounded-md">
              <Globe className="h-4 w-4 mr-2" /> Search Sources
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
                      {providerList.map((p) => {
                        const tr = testResult[p.id!];
                        return (
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
                              {tr?.status === "testing" && (
                                <Badge variant="outline" className="text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing</Badge>
                              )}
                              {tr?.status === "ok" && (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 gap-1.5">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Connected
                                  {tr.latencyMs != null && (
                                    <span className="text-emerald-600 font-mono text-[10px]">{tr.latencyMs}ms</span>
                                  )}
                                </Badge>
                              )}
                              {tr?.status === "fail" && (
                                <Badge
                                  variant="outline"
                                  className="text-red-700 border-red-200 bg-red-50 max-w-[200px]"
                                  title={tr.message}
                                >
                                  <XCircle className="h-3 w-3 mr-1 shrink-0" />
                                  <span className="truncate">Failed{tr.message ? `: ${tr.message}` : ""}</span>
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={tr?.status === "testing"}
                                onClick={() => {
                                  if (!p.id) return;
                                  setTestResult((prev) => ({ ...prev, [p.id!]: { status: "testing" } }));
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
                        );
                      })}
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
                        {effectiveAgent.schedule && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            Runs {parseCronHuman(effectiveAgent.schedule)}
                          </p>
                        )}
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
                          <TableHead>OSINT</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runList.map((run) => {
                          const started = run.createdAt ? new Date(run.createdAt) : null;
                          const ended = (run as { completedAt?: string }).completedAt ? new Date((run as { completedAt: string }).completedAt) : null;
                          const durationMs = started && ended ? ended.getTime() - started.getTime() : null;
                          const ctx = (run as { context?: Record<string, unknown> }).context;
                          const osintCtx = ctx?.osint as { sourcesRun?: string[]; sourcesSucceeded?: string[]; sourcesFailed?: string[] } | undefined;
                          const hasOsint = osintCtx && Array.isArray(osintCtx.sourcesRun) && osintCtx.sourcesRun.length > 0;
                          const totalRun = hasOsint ? osintCtx!.sourcesRun!.length : 0;
                          const totalSucceeded = hasOsint && Array.isArray(osintCtx!.sourcesSucceeded) ? osintCtx!.sourcesSucceeded.length : 0;
                          const totalFailed = hasOsint && Array.isArray(osintCtx!.sourcesFailed) ? osintCtx!.sourcesFailed.length : 0;
                          const sourceNames = hasOsint ? osintCtx!.sourcesRun!.join(", ") : "";
                          return (
                            <TableRow key={run.id}>
                              <TableCell><RunStatusBadge status={run.status} /></TableCell>
                              <TableCell className="text-xs font-mono capitalize">{run.policyTier}</TableCell>
                              <TableCell className="text-xs">{(run as { findingsCount?: number }).findingsCount ?? 0}</TableCell>
                              <TableCell className="text-xs">{(run as { actionsCount?: number }).actionsCount ?? 0}</TableCell>
                              <TableCell className="text-xs">
                                {hasOsint ? (
                                  <span title={`Sources: ${sourceNames}`} className="cursor-help">
                                    <span className="text-green-600 dark:text-green-400">{totalSucceeded}✓</span>
                                    {totalFailed > 0 && (
                                      <span className="text-red-500 ml-1">{totalFailed}✗</span>
                                    )}
                                    <span className="text-muted-foreground ml-1">/{totalRun}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
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

            {/* SEARCH SOURCES TAB */}
            <TabsContent value="sources" className="m-0">
              <OsintSourcesTab />
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

      {/* ADD PROVIDER WIZARD SHEET */}
      <Sheet
        open={providerSheet === "add"}
        onOpenChange={(o) => {
          if (!o) { setProviderSheet("closed"); setWizard(EMPTY_WIZARD); }
        }}
      >
        <SheetContent className="sm:max-w-md w-full border-l overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add LLM Provider</SheetTitle>
            <SheetDescription>
              Follow the steps to connect and verify a language model provider.
            </SheetDescription>
          </SheetHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mt-5 mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    wizard.step === s
                      ? "bg-foreground text-background"
                      : wizard.step > s
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {wizard.step > s ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
                </div>
                {s < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
            <span className="ml-2 text-xs text-muted-foreground">
              {wizard.step === 1 && "Display Name"}
              {wizard.step === 2 && "API Key"}
              {wizard.step === 3 && "Provider"}
              {wizard.step === 4 && "Verify & Configure"}
            </span>
          </div>

          {/* Step 1: Display Name */}
          {wizard.step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  autoFocus
                  placeholder="e.g. GPT-4o Production"
                  value={wizard.name}
                  onChange={(e) => setWizard((prev) => ({ ...prev, name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">A friendly label to identify this provider in the list.</p>
              </div>
              <Button
                className="w-full"
                disabled={!wizard.name.trim()}
                onClick={() => setWizard((prev) => ({ ...prev, step: 2 }))}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 2: API Key */}
          {wizard.step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>API Key <span className="text-muted-foreground font-normal">(optional for local providers)</span></Label>
                <Input
                  autoFocus
                  type="password"
                  placeholder="sk-... or your provider's key"
                  value={wizard.apiKey}
                  onChange={(e) => setWizard((prev) => ({ ...prev, apiKey: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Required for cloud providers (OpenAI, Anthropic, Groq, etc.). Leave blank for Ollama or LM Studio running locally.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setWizard((prev) => ({ ...prev, step: 1 }))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button className="flex-1" onClick={() => setWizard((prev) => ({ ...prev, step: 3 }))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Provider selection */}
          {wizard.step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Provider / Vendor</Label>
                <Select
                  value={wizard.vendor}
                  onValueChange={(v) => {
                    const vendor = v as KnownVendor;
                    const info = VENDOR_BASE_URLS[vendor];
                    setWizard((prev) => ({
                      ...prev,
                      vendor,
                      baseUrl: info?.baseUrl || "",
                      probeResult: null,
                      selectedModel: "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vendor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_OPTIONS.map((v) => (
                      <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {wizard.vendor && !wizardNeedsUrl && (
                <div className="p-3 rounded-lg bg-muted/50 border text-xs font-mono text-muted-foreground">
                  Base URL: {wizardVendorInfo?.baseUrl || "(default)"}
                </div>
              )}

              {wizardNeedsUrl && (
                <div className="space-y-1.5">
                  <Label>Endpoint URL</Label>
                  <Input
                    placeholder={
                      wizard.vendor === "ollama"
                        ? "http://localhost:11434/v1"
                        : wizard.vendor === "lmstudio"
                        ? "http://localhost:1234/v1"
                        : "https://your-endpoint/v1"
                    }
                    value={wizard.baseUrl}
                    onChange={(e) => setWizard((prev) => ({ ...prev, baseUrl: e.target.value, probeResult: null, selectedModel: "" }))}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setWizard((prev) => ({ ...prev, step: 2 }))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!wizardCanProbe}
                  onClick={() => setWizard((prev) => ({ ...prev, step: 4, probeResult: null, selectedModel: "" }))}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Discover & Test */}
          {wizard.step === 4 && (
            <div className="space-y-5">
              <Button
                variant="outline"
                className="w-full"
                disabled={probeMutation.isPending}
                onClick={() => {
                  const info = wizard.vendor ? VENDOR_BASE_URLS[wizard.vendor] : null;
                  const providerType = info?.providerType ?? "openai_compat";
                  const baseUrl = wizardNeedsUrl ? wizard.baseUrl : (info?.baseUrl || undefined);
                  probeMutation.mutate({
                    data: {
                      providerType,
                      vendor: wizard.vendor || undefined,
                      apiKey: wizard.apiKey || undefined,
                      baseUrl: baseUrl || undefined,
                    },
                  });
                }}
              >
                {probeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" />Check Available Models & Connection</>
                )}
              </Button>

              {wizard.probeResult && (
                <div className={`p-3 rounded-lg border text-sm space-y-1 ${wizard.probeResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {wizard.probeResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {wizard.probeResult.success ? "Connection verified" : "Connection failed"}
                    {wizard.probeResult.success && (
                      <span className="ml-auto flex items-center gap-1 text-xs font-mono text-emerald-700">
                        <Gauge className="h-3 w-3" />
                        {wizard.probeResult.latencyMs}ms
                        {wizard.probeResult.tokensPerSecond != null && ` · ${wizard.probeResult.tokensPerSecond} tok/s`}
                      </span>
                    )}
                  </div>
                  {!wizard.probeResult.success && (
                    <p className="text-xs">{wizard.probeResult.message}</p>
                  )}
                </div>
              )}

              {wizard.probeResult?.success && wizard.probeResult.models.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Model</Label>
                  <Input
                    placeholder="Search models…"
                    value={wizard.modelSearch}
                    onChange={(e) => setWizard((prev) => ({ ...prev, modelSearch: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWizard((prev) => ({ ...prev, selectedModel: m }))}
                        className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-muted/50 transition-colors ${
                          wizard.selectedModel === m ? "bg-foreground/5 font-semibold" : ""
                        }`}
                      >
                        {wizard.selectedModel === m && <CheckCircle2 className="h-3 w-3 inline mr-1.5 text-emerald-600" />}
                        {m}
                      </button>
                    ))}
                    {filteredModels.length === 0 && (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">No models match your search.</div>
                    )}
                  </div>
                </div>
              )}

              {wizard.probeResult?.success && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-1.5">
                    <Label>Use Case</Label>
                    <Select
                      value={wizard.useCase}
                      onValueChange={(v) => setWizard((prev) => ({ ...prev, useCase: v }))}
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
                      checked={wizard.isDefault}
                      onCheckedChange={(v) => setWizard((prev) => ({ ...prev, isDefault: v }))}
                    />
                    <div>
                      <div className="text-sm font-medium">Set as default provider</div>
                      <div className="text-xs text-muted-foreground">Used for all AI operations unless a specific use-case provider is configured.</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setWizard((prev) => ({ ...prev, step: 3 }))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!wizard.probeResult?.success || !wizard.selectedModel || createProviderMutation.isPending}
                  onClick={handleWizardSave}
                >
                  {createProviderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Provider
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* EDIT PROVIDER SHEET */}
      <Sheet
        open={providerSheet === "edit"}
        onOpenChange={(o) => {
          if (!o) { setProviderSheet("closed"); setEditingProvider(null); setEditProbeResult(null); setEditModelSearch(""); }
        }}
      >
        <SheetContent className="sm:max-w-md w-full border-l overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit LLM Provider</SheetTitle>
            <SheetDescription>Update the configuration for this provider.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleEditProviderSubmit} className="space-y-5 mt-6">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  disabled={editProbeMutation.isPending}
                  onClick={() => {
                    if (!editingProvider?.id) return;
                    editProbeMutation.mutate({ id: editingProvider.id });
                  }}
                >
                  {editProbeMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Re-test & Refresh Models
                </Button>
              </div>
              <Input
                required
                placeholder={providerForm.providerType === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o"}
                value={providerForm.model}
                onChange={(e) => setProviderForm((prev) => ({ ...prev, model: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {providerForm.providerType === "anthropic"
                  ? "claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307"
                  : "gpt-4o, gpt-4o-mini, gpt-4-turbo, mistral-7b, llama-3-70b, etc."}
              </p>
            </div>

            {editProbeResult && (
              <div className={`p-3 rounded-lg border text-sm space-y-2 ${editProbeResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                <div className="flex items-center gap-2 font-medium">
                  {editProbeResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {editProbeResult.success ? "Connection verified" : "Connection failed"}
                  {editProbeResult.success && (
                    <span className="ml-auto text-xs font-mono text-emerald-700">{editProbeResult.latencyMs}ms</span>
                  )}
                </div>
                {!editProbeResult.success && (
                  <p className="text-xs">{editProbeResult.message}</p>
                )}
                {editProbeResult.success && editProbeResult.models.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Pick a model from available list:</p>
                    <Input
                      placeholder="Search models…"
                      value={editModelSearch}
                      onChange={(e) => setEditModelSearch(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <div className="max-h-36 overflow-y-auto border rounded divide-y bg-white">
                      {editFilteredModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setProviderForm((prev) => ({ ...prev, model: m }))}
                          className={`w-full text-left px-2 py-1.5 text-xs font-mono hover:bg-muted/50 transition-colors ${
                            providerForm.model === m ? "bg-foreground/5 font-semibold" : ""
                          }`}
                        >
                          {providerForm.model === m && <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-600" />}
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
              <Label>API Key <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span></Label>
              <Input
                type="password"
                placeholder="••••••••  (unchanged)"
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
              disabled={updateProviderMutation.isPending}
            >
              {updateProviderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
