import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { LlmConfigWizard } from "./llm-config-wizard";
import { RoutingTableCard } from "./routing-table-card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldAlert, Bot, Server, Loader2, Users, Shield,
  Plus, Pencil, Trash2, CheckCircle2, XCircle,
  Play, RefreshCw, Clock, AlertTriangle, Eye,
  Link2, Zap, TrendingUp, Search, Lightbulb, Ban, X,
  Building2, Timer, Plug, Globe, Cloud, Bug, Mail, ShieldCheck, Target,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

// ── Org Dependencies ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "email", label: "Email Provider" },
  { value: "cloud", label: "Cloud Provider" },
  { value: "cdn", label: "CDN" },
  { value: "identity", label: "Identity Provider" },
  { value: "payment", label: "Payment Processor" },
  { value: "communication", label: "Communication Tools" },
  { value: "other", label: "Other" },
];

type OrgDependency = {
  id: string;
  category: string;
  providerName: string;
  vendorId?: string | null;
  vendorName?: string | null;
  criticality?: string | null;
  notes?: string | null;
};

type ConcentrationRisk = {
  vendorId: string;
  vendorName: string;
  dependencyCount: number;
  categories: string[];
  openSignalCount: number;
};

type Vendor = { id: string; name: string };
type Template = { id: string; name: string };

// ── Monitoring Configs ────────────────────────────────────────────────────────

type MonitoringConfig = {
  id?: string;
  tier: string;
  cadenceDays: number;
  scoreThreshold?: number | null;
  assessmentTemplateId?: string | null;
};

// ── TierBadge (inline, matches vendor-list.tsx pattern) ───────────────────────

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function TierBadge({ tier }: { tier: string }) {
  const cls = TIER_COLORS[tier] || "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={`capitalize ${cls}`}>
      {tier}
    </Badge>
  );
}

// ── ROLES ─────────────────────────────────────────────────────────────────────

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

// ── Integrations ──────────────────────────────────────────────────────────────

type IntegrationSourceField = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "toggle";
  placeholder?: string;
  required?: boolean;
  defaultValue?: boolean;
};

type IntegrationSource = {
  type: string;
  label: string;
  icon: typeof ShieldCheck;
  description: string;
  fields: IntegrationSourceField[];
};

const INTEGRATION_SOURCES: IntegrationSource[] = [
  {
    type: "nvd",
    label: "NVD / CVE",
    icon: ShieldCheck,
    description: "NIST National Vulnerability Database",
    fields: [
      { key: "apiKey", label: "API Key (optional)", type: "password", placeholder: "NVD API key for higher rate limits" },
      { key: "keywords", label: "Product Keywords", type: "text", placeholder: "e.g. microsoft, apache, linux (comma-separated)" },
    ],
  },
  {
    type: "shodan",
    label: "Shodan",
    icon: Globe,
    description: "Internet-connected device search engine",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Shodan API key", required: true },
    ],
  },
  {
    type: "sentinel",
    label: "Microsoft Sentinel",
    icon: Cloud,
    description: "Azure SIEM via Log Analytics API",
    fields: [
      { key: "azureTenantId", label: "Azure Tenant ID", type: "text", placeholder: "Azure AD tenant ID (not RiskMind tenant)", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "App registration client ID", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "App registration client secret", required: true },
      { key: "workspaceId", label: "Log Analytics Workspace ID", type: "text", placeholder: "Workspace GUID", required: true },
    ],
  },
  {
    type: "misp",
    label: "MISP",
    icon: Bug,
    description: "Open-source threat intelligence platform",
    fields: [
      { key: "baseUrl", label: "MISP Instance URL", type: "text", placeholder: "https://misp.example.com", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "MISP automation key", required: true },
    ],
  },
  {
    type: "email",
    label: "Email Inbox",
    icon: Mail,
    description: "IMAP mailbox for security advisories",
    fields: [
      { key: "host", label: "IMAP Host", type: "text", placeholder: "imap.gmail.com", required: true },
      { key: "port", label: "Port", type: "number", placeholder: "993", required: true },
      { key: "user", label: "Username", type: "text", placeholder: "alerts@company.com", required: true },
      { key: "pass", label: "Password", type: "password", placeholder: "App password", required: true },
      { key: "tls", label: "Use TLS", type: "toggle", defaultValue: true },
      { key: "mailbox", label: "Mailbox", type: "text", placeholder: "INBOX" },
    ],
  },
];

type IntegrationConfig = {
  id: string;
  sourceType: string;
  isActive: boolean;
  lastPolledAt?: string | null;
  lastError?: string | null;
};

function IntegrationCard({
  source,
  integration,
  token,
  onRefresh,
}: {
  source: IntegrationSource;
  integration?: IntegrationConfig;
  token: string | null;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: Record<string, string | boolean | number> = {};
      for (const field of source.fields) {
        if (field.type === "toggle") {
          config[field.key] = formValues[field.key] !== undefined ? formValues[field.key] as boolean : (field.defaultValue ?? false);
        } else if (field.type === "number") {
          const v = formValues[field.key] as string;
          if (v) config[field.key] = parseInt(v);
        } else {
          const v = formValues[field.key] as string;
          if (v) config[field.key] = v;
        }
      }
      await fetch("/api/v1/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ sourceType: source.type, config, isActive: true }),
      });
      toast({ title: "Saved", description: `${source.label} configuration saved.` });
      setFormValues({});
      setExpanded(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!integration?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/integrations/${integration.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      const data = await res.json();
      const result = { ok: data.ok ?? false, message: data.message ?? (data.ok ? "Connection successful" : "Connection failed") };
      setTestResult(result);
      toast({
        title: result.ok ? "Connection OK" : "Connection Failed",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    if (!integration?.id) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/integrations/${integration.id}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      const data = await res.json();
      toast({ title: "Sync complete", description: `${data.signalsCreated ?? 0} signals created.` });
      onRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!integration?.id) return;
    await fetch(`/api/v1/integrations/${integration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ isActive }),
    });
    onRefresh();
  };

  const handleRemove = async () => {
    if (!integration?.id) return;
    if (!window.confirm(`Remove ${source.label} integration? This cannot be undone.`)) return;
    await fetch(`/api/v1/integrations/${integration.id}`, {
      method: "DELETE",
      headers: { ...authHeader },
    });
    toast({ title: "Removed", description: `${source.label} integration removed.` });
    onRefresh();
  };

  const Icon = source.icon;
  const isConfigured = !!integration;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{source.label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{source.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConfigured ? (
              integration.isActive ? (
                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  Inactive
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-xs">Not configured</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide" : "Configure"}
            </Button>
          </div>
        </div>
        {isConfigured && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {integration.lastPolledAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last polled: {format(new Date(integration.lastPolledAt), "MMM d, HH:mm")}
              </span>
            )}
            {integration.lastError && (
              <span className="text-red-600 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Error: {integration.lastError.slice(0, 60)}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="border-t pt-4 space-y-3">
            {source.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-sm">{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                {field.type === "toggle" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formValues[field.key] !== undefined ? formValues[field.key] as boolean : (field.defaultValue ?? false)}
                      onCheckedChange={(v) => setFormValues((prev) => ({ ...prev, [field.key]: v }))}
                    />
                    <span className="text-sm text-muted-foreground">{formValues[field.key] !== undefined ? (formValues[field.key] ? "Enabled" : "Disabled") : (field.defaultValue ? "Enabled" : "Disabled")}</span>
                  </div>
                ) : (
                  <Input
                    type={field.type}
                    placeholder={isConfigured && (field.type === "password") ? "Current key saved — enter new value to replace" : field.placeholder}
                    value={(formValues[field.key] as string) || ""}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {source.type === "sentinel" && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-xs text-blue-800">
                  Requires an Azure App Registration with <strong>Log Analytics Reader</strong> role.{" "}
                  <a
                    href="https://learn.microsoft.com/en-us/azure/azure-monitor/logs/api/access-authorization"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    See Microsoft docs
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save
            </Button>
            {isConfigured && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  Test Connection
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncNow}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Sync Now
                </Button>
                <div className="flex items-center gap-2 ml-2">
                  <Switch
                    checked={integration.isActive}
                    onCheckedChange={handleToggleActive}
                    id={`active-${source.type}`}
                  />
                  <Label htmlFor={`active-${source.type}`} className="text-xs text-muted-foreground cursor-pointer">
                    {integration.isActive ? "Active" : "Inactive"}
                  </Label>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive ml-auto"
                  onClick={handleRemove}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              </>
            )}
          </div>

          {testResult && (
            <div className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Risk Appetite Tab ─────────────────────────────────────────────────────────

const APPETITE_CATEGORY_MAP: Record<string, string> = {
  technology: "Cyber",
  operational: "Ops",
  compliance: "Compliance",
  financial: "Financial",
  strategic: "Strategic",
  reputational: "Reputational",
};

const DEFAULT_CATEGORIES = Object.keys(APPETITE_CATEGORY_MAP);

type AppetiteConfig = {
  category: string;
  threshold: number;
};

function AppetiteTab() {
  const [appetiteConfigs, setAppetiteConfigs] = useState<AppetiteConfig[]>([]);
  const [appetiteLoading, setAppetiteLoading] = useState(true);
  const [pendingThresholds, setPendingThresholds] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchAppetite() {
      setAppetiteLoading(true);
      try {
        const res = await fetch("/api/v1/risks/appetite", { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` } });
        if (res.ok) {
          const data = await res.json();
          const configs: AppetiteConfig[] = data.configs || [];
          if (configs.length === 0) {
            // Initialize defaults
            const defaults = DEFAULT_CATEGORIES.map((cat) => ({ category: cat, threshold: 60 }));
            setAppetiteConfigs(defaults);
          } else {
            // Fill in any missing categories with 60 default
            const merged = DEFAULT_CATEGORIES.map((cat) => {
              const found = configs.find((c) => c.category === cat);
              return found ?? { category: cat, threshold: 60 };
            });
            setAppetiteConfigs(merged);
          }
        }
      } catch (_err) {
        const defaults = DEFAULT_CATEGORIES.map((cat) => ({ category: cat, threshold: 60 }));
        setAppetiteConfigs(defaults);
      } finally {
        setAppetiteLoading(false);
      }
    }
    fetchAppetite();
  }, []);

  const handleThresholdChange = (category: string, value: number) => {
    setPendingThresholds((prev) => ({ ...prev, [category]: value }));
  };

  const handleSave = async (category: string) => {
    const threshold = pendingThresholds[category] ?? appetiteConfigs.find((c) => c.category === category)?.threshold ?? 60;
    const displayName = APPETITE_CATEGORY_MAP[category] ?? category;
    try {
      const res = await fetch(`/api/v1/risks/appetite/${category}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` },
        body: JSON.stringify({ threshold }),
      });
      if (res.ok) {
        setAppetiteConfigs((prev) =>
          prev.map((c) => (c.category === category ? { ...c, threshold } : c))
        );
        setPendingThresholds((prev) => {
          const next = { ...prev };
          delete next[category];
          return next;
        });
        toast({ title: "Saved", description: `${displayName} appetite threshold updated to ${threshold}` });
      } else {
        toast({ title: "Error", description: "Failed to update threshold", variant: "destructive" });
      }
    } catch (_err) {
      toast({ title: "Error", description: "Failed to update threshold", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" /> Risk Appetite Thresholds
        </CardTitle>
        <CardDescription>
          Set the composite risk score threshold for each category. Risks above the threshold are flagged as over appetite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {appetiteLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead className="w-40">Threshold (0–100)</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appetiteConfigs.map((cfg) => {
                const displayName = APPETITE_CATEGORY_MAP[cfg.category] ?? cfg.category;
                const current = pendingThresholds[cfg.category] ?? cfg.threshold;
                const isDirty = cfg.category in pendingThresholds;
                return (
                  <TableRow key={cfg.category} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">{cfg.category}</TableCell>
                    <TableCell className="font-medium text-sm">{displayName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={current}
                        className="w-24 h-8 text-sm"
                        onChange={(e) => handleThresholdChange(cfg.category, Number(e.target.value))}
                        onBlur={() => { if (isDirty) handleSave(cfg.category); }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={isDirty ? "default" : "outline"}
                        className="h-8"
                        onClick={() => handleSave(cfg.category)}
                        disabled={!isDirty}
                      >
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

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

  // ── Auth helper for raw fetch calls ─────────────────────────────────────────
  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  };

  // ── Org Dependencies queries ────────────────────────────────────────────────
  const { data: dependencies, refetch: refetchDeps } = useQuery<OrgDependency[]>({
    queryKey: ["/api/v1/org-dependencies"],
    queryFn: () => fetch("/api/v1/org-dependencies", { headers: authHeaders() }).then((r) => r.json()).then((d) => d.data ?? d),
  });

  const { data: concentrationRisks } = useQuery<ConcentrationRisk[]>({
    queryKey: ["/api/v1/org-dependencies/concentration-risk"],
    queryFn: () => fetch("/api/v1/org-dependencies/concentration-risk", { headers: authHeaders() }).then((r) => r.json()),
  });

  const { data: allVendors } = useQuery<Vendor[]>({
    queryKey: ["/api/v1/vendors-all"],
    queryFn: () => fetch("/api/v1/vendors?limit=500", { headers: authHeaders() }).then((r) => r.json()).then((d) => d.data ?? d),
  });

  // ── Org dependency edit state ───────────────────────────────────────────────
  const [editingDeps, setEditingDeps] = useState(false);
  const [editData, setEditData] = useState<Record<string, { providerName: string; vendorId: string | null }>>({});

  const openEditDeps = () => {
    const initial: Record<string, { providerName: string; vendorId: string | null }> = {};
    for (const cat of CATEGORIES) {
      const existing = (dependencies || []).find((d) => d.category === cat.value);
      initial[cat.value] = { providerName: existing?.providerName || "", vendorId: existing?.vendorId || null };
    }
    setEditData(initial);
    setEditingDeps(true);
  };

  const handleSaveDeps = async () => {
    const depList = dependencies || [];
    const promises = CATEGORIES.map(async (cat) => {
      const entry = editData[cat.value];
      if (!entry) return;
      const existing = depList.find((d) => d.category === cat.value);
      const body = {
        providerName: entry.providerName,
        vendorId: entry.vendorId || undefined,
        category: cat.value,
      };
      if (existing) {
        await fetch(`/api/v1/org-dependencies/${existing.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
      } else if (entry.providerName.trim()) {
        await fetch("/api/v1/org-dependencies", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
      }
    });
    await Promise.all(promises);
    await refetchDeps();
    setEditingDeps(false);
    toast({ title: "Dependencies saved", description: "Infrastructure dependencies updated successfully." });
  };

  // ── Monitoring config queries & state ───────────────────────────────────────
  const { data: monitoringConfigs, refetch: refetchMonitoring } = useQuery<MonitoringConfig[]>({
    queryKey: ["/api/v1/monitoring-configs"],
    queryFn: () => fetch("/api/v1/monitoring-configs", { headers: authHeaders() }).then((r) => r.json()).then((d) => d.data ?? d),
    enabled: user?.role === "admin",
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/v1/assessment-templates"],
    queryFn: () => fetch("/api/v1/assessment-templates", { headers: authHeaders() }).then((r) => r.json()).then((d) => d.data ?? d),
    enabled: user?.role === "admin",
  });

  const [cadenceData, setCadenceData] = useState<Record<string, { cadenceDays: number; scoreThreshold: number | null; assessmentTemplateId: string | null }>>({
    critical: { cadenceDays: 7, scoreThreshold: 50, assessmentTemplateId: null },
    high: { cadenceDays: 30, scoreThreshold: 60, assessmentTemplateId: null },
    medium: { cadenceDays: 90, scoreThreshold: 75, assessmentTemplateId: null },
    low: { cadenceDays: 180, scoreThreshold: null, assessmentTemplateId: null },
  });

  useEffect(() => {
    if (monitoringConfigs && monitoringConfigs.length > 0) {
      setCadenceData((prev) => {
        const next = { ...prev };
        for (const cfg of monitoringConfigs) {
          if (cfg.tier) {
            next[cfg.tier] = {
              cadenceDays: cfg.cadenceDays ?? prev[cfg.tier]?.cadenceDays ?? 7,
              scoreThreshold: cfg.scoreThreshold ?? null,
              assessmentTemplateId: cfg.assessmentTemplateId ?? null,
            };
          }
        }
        return next;
      });
    }
  }, [monitoringConfigs]);

  const handleSaveCadence = async () => {
    for (const tier of ["critical", "high", "medium", "low"]) {
      const entry = cadenceData[tier];
      if (!entry || entry.cadenceDays < 1 || entry.cadenceDays > 365) {
        toast({ title: "Invalid cadence", description: "Enter a number between 1 and 365.", variant: "destructive" });
        return;
      }
      if (entry.scoreThreshold !== null && (entry.scoreThreshold < 0 || entry.scoreThreshold > 100)) {
        toast({ title: "Invalid threshold", description: "Score threshold must be between 0 and 100.", variant: "destructive" });
        return;
      }
    }
    const promises = ["critical", "high", "medium", "low"].map((tier) => {
      const entry = cadenceData[tier];
      if (!entry || entry.cadenceDays <= 0) return Promise.resolve();
      return fetch(`/api/v1/monitoring-configs/${tier}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          cadenceDays: entry.cadenceDays,
          assessmentTemplateId: entry.assessmentTemplateId || undefined,
          scoreThreshold: entry.scoreThreshold,
        }),
      });
    });
    await Promise.all(promises);
    await refetchMonitoring();
    toast({ title: "Cadence saved", description: "Monitoring cadence configuration updated successfully." });
  };

  const [savingCadence, setSavingCadence] = useState(false);

  // ── Integrations state ──────────────────────────────────────────────────────
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [intLoading, setIntLoading] = useState(false);

  const fetchIntegrations = () => {
    const token = localStorage.getItem("accessToken");
    setIntLoading(true);
    fetch("/api/v1/integrations", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => setIntegrations(data.data ?? []))
      .catch(() => setIntegrations([]))
      .finally(() => setIntLoading(false));
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const [wizardOpen, setWizardOpen] = useState(false);
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
            <TabsTrigger value="organization" className="data-[state=active]:shadow-sm rounded-md">
              <Building2 className="h-4 w-4 mr-2" /> Organization
            </TabsTrigger>
            {user?.role === "admin" && (
              <TabsTrigger value="monitoring" className="data-[state=active]:shadow-sm rounded-md">
                <Timer className="h-4 w-4 mr-2" /> Monitoring
              </TabsTrigger>
            )}
            {user?.role === "admin" && (
              <TabsTrigger value="integrations" className="data-[state=active]:shadow-sm rounded-md">
                <Plug className="h-4 w-4 mr-2" />Integrations
              </TabsTrigger>
            )}
            {user?.role === "admin" && (
              <TabsTrigger value="appetite" className="data-[state=active]:shadow-sm rounded-md">
                <Target className="h-4 w-4 mr-2" /> Risk Appetite
              </TabsTrigger>
            )}
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
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                      <Zap className="h-4 w-4 mr-2" /> Configure with Wizard
                    </Button>
                    <Button onClick={openAddProvider} size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Add Provider
                    </Button>
                  </div>
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

              <RoutingTableCard tenantId={user.tenantId ?? ""} />
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

            {/* ORGANIZATION TAB */}
            <TabsContent value="organization" className="m-0 space-y-6">
              {/* Concentration Risk Summary */}
              {Array.isArray(concentrationRisks) && concentrationRisks.length > 0 ? (
                <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" role="alert">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <AlertTitle>Concentration Risk Detected</AlertTitle>
                  <AlertDescription>
                    {concentrationRisks.map((r) => (
                      <div key={r.vendorId} className="mt-2">
                        <span className="font-semibold">{r.vendorName}</span> — {r.dependencyCount} dependencies
                        ({r.categories.join(", ")})
                        {r.openSignalCount > 0 && (
                          <Badge variant="destructive" className="ml-2">{r.openSignalCount} open signals</Badge>
                        )}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              ) : (
                <Card className="border-muted">
                  <CardContent className="flex items-center gap-3 py-4 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    No concentration risks detected.
                  </CardContent>
                </Card>
              )}

              {/* Infrastructure Dependencies */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold">Infrastructure Dependencies</CardTitle>
                    <CardDescription className="mt-1">Map your organization's critical infrastructure to vendors to detect concentration risk.</CardDescription>
                  </div>
                  {!editingDeps && (
                    <Button variant="outline" size="sm" onClick={openEditDeps}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit All
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {!Array.isArray(dependencies) || (dependencies.length === 0 && !editingDeps) ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl space-y-3">
                      <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                      <div>
                        <p className="font-medium">No Dependencies Configured</p>
                        <p className="text-sm text-muted-foreground mt-1">Define your organization's critical infrastructure dependencies to detect concentration risk.</p>
                      </div>
                      <Button variant="outline" onClick={openEditDeps}>
                        <Plus className="h-4 w-4 mr-2" /> Configure
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {CATEGORIES.map((cat) => {
                        const existing = (dependencies || []).find((d) => d.category === cat.value);
                        if (editingDeps) {
                          const entry = editData[cat.value] || { providerName: "", vendorId: null };
                          return (
                            <div key={cat.value} className="grid grid-cols-[160px_1fr_1fr] gap-3 items-center py-2 border-b last:border-0">
                              <Label className="text-sm font-semibold">{cat.label}</Label>
                              <Input
                                placeholder="Provider name (e.g. AWS)"
                                value={entry.providerName}
                                onChange={(e) =>
                                  setEditData((prev) => ({ ...prev, [cat.value]: { ...prev[cat.value], providerName: e.target.value } }))
                                }
                              />
                              <Select
                                value={entry.vendorId || "none"}
                                onValueChange={(val) =>
                                  setEditData((prev) => ({ ...prev, [cat.value]: { ...prev[cat.value], vendorId: val === "none" ? null : val } }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Link to vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {(allVendors || []).map((v) => (
                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }
                        return (
                          <div key={cat.value} className="grid grid-cols-[160px_1fr] gap-3 items-center py-2 border-b last:border-0">
                            <Label className="text-sm font-semibold">{cat.label}</Label>
                            {existing ? (
                              <span className="text-sm">
                                {existing.providerName}
                                {existing.vendorName && (
                                  <span className="text-muted-foreground ml-1">— {existing.vendorName}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not configured</span>
                            )}
                          </div>
                        );
                      })}
                      {editingDeps && (
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setEditingDeps(false)}>Cancel</Button>
                          <Button onClick={handleSaveDeps}>Save Dependencies</Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* MONITORING TAB (admin only) */}
            {user?.role === "admin" && (
              <TabsContent value="monitoring" className="m-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold">Monitoring Cadence</CardTitle>
                    <CardDescription>
                      Define how frequently vendors are re-assessed based on tier, and set score thresholds for automatic alerts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Array.isArray(monitoringConfigs) || true ? (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tier</TableHead>
                              <TableHead>Cadence (days)</TableHead>
                              <TableHead>Score Threshold</TableHead>
                              <TableHead>Assessment Template</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {["critical", "high", "medium", "low"].map((tier) => (
                              <TableRow key={tier}>
                                <TableCell><TierBadge tier={tier} /></TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={cadenceData[tier]?.cadenceDays ?? ""}
                                    onChange={(e) =>
                                      setCadenceData((prev) => ({
                                        ...prev,
                                        [tier]: { ...prev[tier], cadenceDays: parseInt(e.target.value) || 0 },
                                      }))
                                    }
                                    className="w-24"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="No alert"
                                    value={cadenceData[tier]?.scoreThreshold ?? ""}
                                    onChange={(e) =>
                                      setCadenceData((prev) => ({
                                        ...prev,
                                        [tier]: {
                                          ...prev[tier],
                                          scoreThreshold: e.target.value === "" ? null : parseInt(e.target.value) || 0,
                                        },
                                      }))
                                    }
                                    className="w-24"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={cadenceData[tier]?.assessmentTemplateId || "none"}
                                    onValueChange={(val) =>
                                      setCadenceData((prev) => ({
                                        ...prev,
                                        [tier]: { ...prev[tier], assessmentTemplateId: val === "none" ? null : val },
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-64">
                                      <SelectValue placeholder="Select template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No template</SelectItem>
                                      {(templates || []).map((t) => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-2">
                          Typical: Critical = 7 days, High = 30, Medium = 90, Low = 180. Threshold: alert when vendor risk score reaches this value (0–100, higher = worse). Leave empty for no alerts.
                        </p>
                        <div className="flex justify-end">
                          <Button
                            onClick={async () => {
                              setSavingCadence(true);
                              try { await handleSaveCadence(); } finally { setSavingCadence(false); }
                            }}
                            disabled={savingCadence}
                          >
                            {savingCadence && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Cadence
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 border-2 border-dashed rounded-xl space-y-3">
                        <Timer className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <div>
                          <p className="font-medium">Monitoring Not Configured</p>
                          <p className="text-sm text-muted-foreground mt-1">Set cadence rules for each vendor tier to schedule automatic re-assessments.</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* INTEGRATIONS TAB */}
            {user?.role === "admin" && (
              <TabsContent value="integrations" className="m-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> Signal Integrations</CardTitle>
                    <CardDescription>Configure external signal sources. Credentials are encrypted at rest and never exposed in API responses.</CardDescription>
                  </CardHeader>
                </Card>
                {intLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-3">
                    {INTEGRATION_SOURCES.map((source) => {
                      const integration = integrations.find((i) => i.sourceType === source.type);
                      const token = localStorage.getItem("accessToken");
                      return (
                        <IntegrationCard
                          key={source.type}
                          source={source}
                          integration={integration}
                          token={token}
                          onRefresh={fetchIntegrations}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            )}

            {/* RISK APPETITE TAB */}
            {user?.role === "admin" && (
              <TabsContent value="appetite" className="m-0 space-y-4">
                <AppetiteTab />
              </TabsContent>
            )}

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

      {/* LLM CONFIG WIZARD */}
      <LlmConfigWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        tenantId={user.tenantId ?? ""}
        onComplete={() => {
          setWizardOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-providers"] });
          queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-routing"] });
        }}
      />

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
