import { useState } from "react";
import {
  useListOsintSources,
  useUpdateOsintSource,
  useTestOsintSource,
  useDeleteOsintSource,
} from "@workspace/api-client-react";
import type { OsintSource } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2, CheckCircle2, XCircle, Play, Globe, Mail,
  Radio, Server, Shield, AlertTriangle, RefreshCw, Trash2, Clock
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type SourceType = "perplexity" | "alienvault_otx" | "censys" | "nvd_cisa" | "email_imap";

interface SourceMeta {
  label: string;
  icon: typeof Globe;
  description: string;
  requiresKey: boolean;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    type?: "text" | "password" | "number";
  }>;
}

const SOURCE_META: Record<SourceType, SourceMeta> = {
  perplexity: {
    label: "Perplexity API",
    icon: Globe,
    description: "Real-time web search powered by Perplexity AI. Retrieves curated threat intelligence and recent cybersecurity incidents.",
    requiresKey: true,
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "pplx-...", type: "password" },
    ],
  },
  alienvault_otx: {
    label: "AlienVault OTX",
    icon: Radio,
    description: "Open Threat Exchange (OTX) — community-sourced threat pulses, indicators of compromise, and malware signatures.",
    requiresKey: true,
    fields: [
      { key: "apiKey", label: "OTX API Key", placeholder: "Your AlienVault OTX DirectConnect API key", type: "password" },
    ],
  },
  censys: {
    label: "Censys",
    icon: Server,
    description: "Censys Search API v2 — internet-wide host and certificate scanning to identify exposed assets and misconfigurations.",
    requiresKey: true,
    fields: [
      { key: "apiId", label: "API ID", placeholder: "Censys API ID", type: "text" },
      { key: "apiSecret", label: "API Secret", placeholder: "Censys API Secret", type: "password" },
    ],
  },
  nvd_cisa: {
    label: "NVD + CISA KEV",
    icon: Shield,
    description: "NIST National Vulnerability Database (NVD) for recent CVEs and CISA Known Exploited Vulnerabilities (KEV) catalog. No API key required.",
    requiresKey: false,
    fields: [],
  },
  email_imap: {
    label: "Email Ingest (IMAP)",
    icon: Mail,
    description: "Connect to an IMAP mailbox to ingest and parse unread threat intelligence emails. Also used as the From address for agent-sent notifications.",
    requiresKey: true,
    fields: [
      { key: "host", label: "IMAP Host", placeholder: "imap.example.com", type: "text" },
      { key: "port", label: "Port", placeholder: "993", type: "number" },
      { key: "username", label: "Username / Email", placeholder: "alerts@example.com", type: "text" },
      { key: "password", label: "Password", placeholder: "••••••••", type: "password" },
      { key: "mailbox", label: "Mailbox Folder", placeholder: "INBOX", type: "text" },
      { key: "smtpFromAddress", label: "From Address (outbound)", placeholder: "agent@example.com", type: "text" },
      { key: "smtpFromName", label: "From Name (outbound)", placeholder: "RiskMind Agent", type: "text" },
    ],
  },
};

function LastRunBadge({ status, lastRunAt }: { status?: string; lastRunAt?: string | null }) {
  if (!status || status === "never_run") {
    return <Badge variant="outline" className="text-muted-foreground text-xs"><Clock className="h-3 w-3 mr-1" />Never run</Badge>;
  }
  const timeAgo = lastRunAt ? formatDistanceToNow(new Date(lastRunAt), { addSuffix: true }) : "";
  if (status === "success") {
    return (
      <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />Success {timeAgo}
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 text-xs">
        <XCircle className="h-3 w-3 mr-1" />Failed {timeAgo}
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function SourceCard({ source, sourceType }: { source: OsintSource | null; sourceType: SourceType }) {
  const meta = SOURCE_META[sourceType];
  const Icon = meta.icon;
  const queryClient = useQueryClient();

  const currentEnabled = source?.enabled ?? false;
  const currentCreds = (source?.credentials as Record<string, string> | undefined) ?? {};

  const [localEnabled, setLocalEnabled] = useState<boolean>(currentEnabled);
  const [localCreds, setLocalCreds] = useState<Record<string, string>>(
    meta.fields.reduce((acc, f) => ({ ...acc, [f.key]: currentCreds[f.key] ?? "" }), {} as Record<string, string>)
  );
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMessage, setTestMessage] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);

  const updateMutation = useUpdateOsintSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/sources"] });
        setIsDirty(false);
      },
    },
  });

  const deleteMutation = useDeleteOsintSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/sources"] });
        setLocalCreds(meta.fields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {} as Record<string, string>));
        setLocalEnabled(false);
      },
    },
  });

  const testMutation = useTestOsintSource({
    mutation: {
      onSuccess: (data) => {
        setTestStatus(data.success ? "ok" : "fail");
        setTestMessage(data.success ? (data.summary || "Connection successful") : (data.error || "Test failed"));
        setTimeout(() => { setTestStatus("idle"); setTestMessage(""); }, 6000);
      },
      onError: () => {
        setTestStatus("fail");
        setTestMessage("Test request failed");
        setTimeout(() => { setTestStatus("idle"); setTestMessage(""); }, 4000);
      },
    },
  });

  const handleSave = () => {
    const credentials = meta.fields.reduce((acc, f) => {
      if (localCreds[f.key]) acc[f.key] = localCreds[f.key];
      return acc;
    }, {} as Record<string, string>);

    updateMutation.mutate({
      sourceType,
      data: { enabled: localEnabled, credentials },
    });
  };

  const handleTest = () => {
    setTestStatus("testing");
    const credentials = meta.fields.reduce((acc, f) => {
      if (localCreds[f.key] && localCreds[f.key] !== "••••••••") acc[f.key] = localCreds[f.key];
      return acc;
    }, {} as Record<string, string>);
    testMutation.mutate({ sourceType, data: { credentials } });
  };

  const handleCredChange = (key: string, value: string) => {
    setLocalCreds((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleToggle = (val: boolean) => {
    setLocalEnabled(val);
    setIsDirty(true);
  };

  const isEnabled = localEnabled;
  const hasUnsavedChanges = isDirty;
  const isSaving = updateMutation.isPending;

  return (
    <Card className={`transition-colors ${isEnabled ? "border-primary/30 bg-primary/2" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
              <Icon className={`h-5 w-5 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <CardTitle className="text-base">{meta.label}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <LastRunBadge status={source?.lastRunStatus} lastRunAt={source?.lastRunAt} />
                {source?.hasCredentials && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Credentials saved</Badge>
                )}
                {!meta.requiresKey && (
                  <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50">No key required</Badge>
                )}
              </div>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        </div>
        <CardDescription className="mt-2 text-xs leading-relaxed">{meta.description}</CardDescription>
        {source?.lastRunError && (
          <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            Last error: {source.lastRunError}
          </div>
        )}
      </CardHeader>

      {(meta.fields.length > 0 || isEnabled) && (
        <CardContent className="pt-0 space-y-4">
          {meta.fields.length > 0 && (
            <div className={`space-y-3 ${!isEnabled ? "opacity-60" : ""}`}>
              {meta.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{field.label}</Label>
                  <Input
                    type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                    placeholder={field.placeholder}
                    value={localCreds[field.key] ?? ""}
                    onChange={(e) => handleCredChange(field.key, e.target.value)}
                    disabled={!isEnabled && !source?.hasCredentials}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          {testStatus !== "idle" && (
            <div className={`p-2 rounded-lg text-xs ${testStatus === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : testStatus === "fail" ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
              {testStatus === "testing" && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
              {testStatus === "ok" && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
              {testStatus === "fail" && <XCircle className="h-3 w-3 inline mr-1" />}
              {testMessage || (testStatus === "testing" ? "Testing connection..." : "")}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="h-7 text-xs"
            >
              {isSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {isSaving ? "Saving..." : "Save"}
            </Button>
            {(meta.fields.length > 0 || !meta.requiresKey) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                disabled={testStatus === "testing" || testMutation.isPending}
                className="h-7 text-xs"
              >
                {testStatus === "testing" ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Test
              </Button>
            )}
            {source?.id && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteMutation.mutate({ sourceType })}
                disabled={deleteMutation.isPending}
                className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Clear credentials
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function OsintSourcesTab() {
  const { data: sources, isLoading } = useListOsintSources({ query: { queryKey: ["/api/v1/agent/sources"] } });
  const queryClient = useQueryClient();

  const sourceTypes: SourceType[] = ["perplexity", "alienvault_otx", "censys", "nvd_cisa", "email_imap"];

  const getSource = (type: SourceType): OsintSource | null => {
    if (!sources) return null;
    return sources.find((s) => s.sourceType === type) ?? null;
  };

  const enabledCount = sources?.filter((s) => s.enabled).length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5" /> External Search Sources & Tools
            </CardTitle>
            <CardDescription className="mt-1">
              Configure OSINT data sources used by the Risk Intelligence Agent during scheduled analysis runs.
              Enabled sources are queried each cycle and their findings injected into the agent's threat analysis.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enabledCount > 0 && (
              <Badge className="text-xs">{enabledCount} active</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/v1/agent/sources"] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground p-3 bg-muted/40 rounded-lg mb-4">
            Sources run on the agent's configured schedule (see Agent Config tab). Results are aggregated and fed into the agent's analysis prompt as additional context.
            API keys and credentials are encrypted at rest.
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3">
              {sourceTypes.map((type) => (
                <SourceCard key={type} source={getSource(type)} sourceType={type} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
