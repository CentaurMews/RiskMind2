import { useState, useEffect } from "react";
import {
  useCreateLlmProvider,
  useTestLlmProvider,
  useDiscoverLlmModels,
  useUpdateLlmProvider,
  useBenchmarkLlmProvider,
  useGetLlmRouting,
  useUpdateLlmRouting,
} from "@workspace/api-client-react";
import type {
  LlmDiscoveredModel,
  LlmBenchmarkResult,
} from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Provider catalog ────────────────────────────────────────────────────────

const PROVIDER_CATALOG = [
  {
    id: "openai_compat",
    name: "OpenAI",
    description: "GPT-4o, o1, o3-mini",
    capabilities: ["Chat", "Embeddings", "Code"],
    tier: "Pay-per-token",
    baseUrl: "",
    requiresBaseUrl: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 3.5 Sonnet, Claude 3 Opus",
    capabilities: ["Chat", "Analysis"],
    tier: "Pay-per-token",
    baseUrl: "",
    requiresBaseUrl: false,
  },
  {
    id: "openai_compat",
    name: "Google Gemini",
    description: "Gemini 1.5 Pro, Gemini Flash",
    capabilities: ["Chat", "Embeddings"],
    tier: "Pay-per-token",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    requiresBaseUrl: false,
  },
  {
    id: "openai_compat",
    name: "Mistral",
    description: "Mistral Large, Mixtral 8x7B",
    capabilities: ["Chat", "Code"],
    tier: "Pay-per-token",
    baseUrl: "https://api.mistral.ai/v1",
    requiresBaseUrl: false,
  },
  {
    id: "openai_compat",
    name: "Groq",
    description: "Llama 3.3, Gemma 2, DeepSeek",
    capabilities: ["Chat", "Fast inference"],
    tier: "Pay-per-token",
    baseUrl: "https://api.groq.com/openai/v1",
    requiresBaseUrl: false,
  },
  {
    id: "openai_compat",
    name: "Together AI",
    description: "70B+ open models, FLUX",
    capabilities: ["Chat", "Code", "Embeddings"],
    tier: "Pay-per-token",
    baseUrl: "https://api.together.xyz/v1",
    requiresBaseUrl: false,
  },
  {
    id: "openai_compat",
    name: "Ollama / Private",
    description: "Self-hosted models",
    capabilities: ["Private", "No data leaving"],
    tier: "Self-hosted",
    baseUrl: "http://localhost:11434",
    requiresBaseUrl: true,
  },
] as const;

type ProviderEntry = (typeof PROVIDER_CATALOG)[number];

// ─── Task types ───────────────────────────────────────────────────────────────

const TASK_TYPES = [
  "enrichment",
  "triage",
  "treatment",
  "embeddings",
  "agent",
  "general",
] as const;

const TASK_TYPE_LABELS: Record<string, string> = {
  enrichment: "Enrichment",
  triage: "Triage",
  treatment: "Treatment",
  embeddings: "Embeddings",
  agent: "Agent",
  general: "General",
};

// ─── Quality labels ───────────────────────────────────────────────────────────

const QUALITY_LABELS = [
  "No JSON",
  "Partial JSON",
  "Valid keys",
  "Full quality",
] as const;

// ─── Step names ───────────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Provider",
  "Credentials",
  "Discover",
  "Select Model",
  "Benchmark",
  "Routing",
];

// ─── Wizard state shape ───────────────────────────────────────────────────────

interface WizardData {
  selectedProvider: ProviderEntry | null;
  configId: string | null;
  providerName: string;
  apiKey: string;
  baseUrl: string;
  discoveredModels: LlmDiscoveredModel[];
  selectedModel: string;
  benchmarkResult: LlmBenchmarkResult | null;
  routing: Record<string, string>;
}

const EMPTY_WIZARD: WizardData = {
  selectedProvider: null,
  configId: null,
  providerName: "",
  apiKey: "",
  baseUrl: "",
  discoveredModels: [],
  selectedModel: "",
  benchmarkResult: null,
  routing: {},
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface LlmConfigWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onComplete: () => void;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  currentStep,
  completedUpTo,
  onStepClick,
}: {
  currentStep: number;
  completedUpTo: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="flex items-start gap-1 mb-6 overflow-x-auto pb-2">
      {STEP_LABELS.map((label, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < completedUpTo;
        const isClickable = isCompleted;
        return (
          <div key={idx} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(idx)}
              className={`flex flex-col items-center gap-1 group ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : isCompleted
                    ? "bg-primary/10 text-primary border-primary"
                    : "bg-background text-muted-foreground border-muted-foreground/30"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-[10px] font-medium text-center w-14 leading-tight ${
                  isActive
                    ? "text-foreground"
                    : isCompleted
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </button>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={`h-px w-4 mt-[-10px] shrink-0 ${
                  idx < completedUpTo ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main wizard component ───────────────────────────────────────────────────

export function LlmConfigWizard({
  open,
  onOpenChange,
  onComplete,
}: LlmConfigWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [completedUpTo, setCompletedUpTo] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(EMPTY_WIZARD);

  // Step 1 — test connection state
  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [testError, setTestError] = useState<string>("");

  // Reset on close
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setStep(0);
      setCompletedUpTo(0);
      setWizardData(EMPTY_WIZARD);
      setTestState("idle");
      setTestError("");
    }
    onOpenChange(o);
  };

  const goNext = () => {
    const next = step + 1;
    setCompletedUpTo((prev) => Math.max(prev, next));
    setStep(next);
  };

  const goBack = () => {
    setStep((prev) => Math.max(0, prev - 1));
  };

  // ─── Mutations ───────────────────────────────────────────────────────────

  const createProviderMutation = useCreateLlmProvider({
    mutation: {
      onSuccess: (data) => {
        setWizardData((prev) => ({
          ...prev,
          configId: (data as { id?: string }).id ?? null,
        }));
        goNext(); // advance to Step 2 — discover
      },
    },
  });

  const testProviderMutation = useTestLlmProvider({
    mutation: {
      onSuccess: (data) => {
        const result = data as { success?: boolean; error?: string };
        if (result?.success === false) {
          setTestState("fail");
          setTestError(result.error ?? "Connection failed");
        } else {
          setTestState("ok");
        }
      },
      onError: (err: unknown) => {
        setTestState("fail");
        setTestError(
          (err as { message?: string })?.message ?? "Connection failed"
        );
      },
    },
  });

  const discoverMutation = useDiscoverLlmModels({
    mutation: {
      onSuccess: (data) => {
        const models = Array.isArray(
          (data as { models?: LlmDiscoveredModel[] })?.models
        )
          ? (data as { models: LlmDiscoveredModel[] }).models
          : [];
        setWizardData((prev) => ({ ...prev, discoveredModels: models }));
      },
    },
  });

  const updateProviderMutation = useUpdateLlmProvider({
    mutation: {
      onSuccess: () => {
        goNext(); // advance to step 4 — benchmark
      },
    },
  });

  const benchmarkMutation = useBenchmarkLlmProvider({
    mutation: {
      onSuccess: (data) => {
        setWizardData((prev) => ({
          ...prev,
          benchmarkResult: data as LlmBenchmarkResult,
        }));
      },
    },
  });

  const updateRoutingMutation = useUpdateLlmRouting({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["/api/v1/settings/llm-routing"],
        });
        onComplete();
      },
    },
  });

  // ─── Step 2 — auto-discover on mount ────────────────────────────────────

  useEffect(() => {
    if (step === 2 && wizardData.configId && !discoverMutation.data && !discoverMutation.isPending && !discoverMutation.isError) {
      discoverMutation.mutate({ id: wizardData.configId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, wizardData.configId]);

  // ─── Step 5 — routing ───────────────────────────────────────────────────

  const routingQuery = useGetLlmRouting({
    query: {
      queryKey: ["/api/v1/settings/llm-routing"],
      enabled: step === 5,
    },
  });

  // Pre-fill routing from suggestions on step 5 entry
  useEffect(() => {
    if (step === 5 && routingQuery.data) {
      const suggestions = routingQuery.data.suggestions ?? {};
      const newRouting: Record<string, string> = {};
      for (const t of TASK_TYPES) {
        newRouting[t] = suggestions[t] ?? wizardData.selectedModel ?? "";
      }
      setWizardData((prev) => ({ ...prev, routing: newRouting }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, routingQuery.data]);

  // ─── Grouped models (Step 2) ─────────────────────────────────────────────

  const groupedModels = wizardData.discoveredModels.reduce<
    Record<string, LlmDiscoveredModel[]>
  >((acc, model) => {
    const cap = model.capability?.[0] ?? "other";
    if (!acc[cap]) acc[cap] = [];
    acc[cap].push(model);
    return acc;
  }, {});

  // ─── Render steps ────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Provider selection ──────────────────────────────────────
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">
                Choose a Provider
              </h2>
              <p className="text-sm text-muted-foreground">
                Select the LLM provider you want to configure.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PROVIDER_CATALOG.map((provider, idx) => {
                const isSelected =
                  wizardData.selectedProvider?.name === provider.name;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setWizardData((prev) => ({
                        ...prev,
                        selectedProvider: provider,
                        baseUrl: provider.baseUrl,
                        providerName: provider.name,
                      }))
                    }
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50 hover:bg-muted/20"
                    }`}
                  >
                    <div className="font-semibold text-sm mb-1">
                      {provider.name}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {provider.description}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {provider.capabilities.map((cap) => (
                        <Badge
                          key={cap}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {cap}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {provider.tier}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={goNext}
                disabled={!wizardData.selectedProvider}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        );

      // ── Step 1: Credentials ─────────────────────────────────────────────
      case 1: {
        const showBaseUrl =
          wizardData.selectedProvider?.requiresBaseUrl ||
          wizardData.selectedProvider?.baseUrl !== "";

        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Credentials</h2>
              <p className="text-sm text-muted-foreground">
                Enter your API key and connection details for{" "}
                <strong>{wizardData.selectedProvider?.name}</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Provider Nickname</Label>
              <Input
                placeholder={`e.g. ${wizardData.selectedProvider?.name} Production`}
                value={wizardData.providerName}
                onChange={(e) =>
                  setWizardData((prev) => ({
                    ...prev,
                    providerName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={wizardData.apiKey}
                onChange={(e) =>
                  setWizardData((prev) => ({
                    ...prev,
                    apiKey: e.target.value,
                  }))
                }
              />
            </div>

            {showBaseUrl && (
              <div className="space-y-1.5">
                <Label>Base URL</Label>
                <Input
                  placeholder="https://..."
                  value={wizardData.baseUrl}
                  onChange={(e) =>
                    setWizardData((prev) => ({
                      ...prev,
                      baseUrl: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {wizardData.selectedProvider?.requiresBaseUrl
                    ? "Required for self-hosted deployments."
                    : "Pre-filled for this provider. Only change if you use a custom endpoint."}
                </p>
              </div>
            )}

            {/* Test connection */}
            {wizardData.configId && (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testState === "testing"}
                  onClick={() => {
                    if (!wizardData.configId) return;
                    setTestState("testing");
                    setTestError("");
                    testProviderMutation.mutate({ id: wizardData.configId });
                  }}
                >
                  {testState === "testing" ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
                {testState === "ok" && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Connection successful
                  </div>
                )}
                {testState === "fail" && (
                  <div className="flex items-start gap-2 text-sm text-red-700 p-3 bg-red-50 rounded-lg border border-red-200">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{testError || "Connection failed"}</span>
                  </div>
                )}
              </div>
            )}

            {createProviderMutation.isError && (
              <div className="text-sm text-red-700 p-3 bg-red-50 rounded-lg border border-red-200">
                Failed to save provider. Please check your credentials.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                disabled={
                  !wizardData.providerName ||
                  !wizardData.apiKey ||
                  createProviderMutation.isPending
                }
                onClick={() => {
                  if (!wizardData.selectedProvider) return;
                  createProviderMutation.mutate({
                    data: {
                      name: wizardData.providerName,
                      providerType: wizardData.selectedProvider.id as "openai_compat" | "anthropic",
                      baseUrl: wizardData.baseUrl || undefined,
                      apiKey: wizardData.apiKey,
                      model: "pending",
                      isDefault: false,
                    },
                  });
                }}
              >
                {createProviderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save &amp; Continue
              </Button>
            </div>
          </div>
        );
      }

      // ── Step 2: Model discovery ─────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">
                Discovering Models
              </h2>
              <p className="text-sm text-muted-foreground">
                Fetching available models from{" "}
                <strong>{wizardData.selectedProvider?.name}</strong>…
              </p>
            </div>

            {discoverMutation.isPending && (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            )}

            {discoverMutation.isError && (
              <div className="text-sm text-red-700 p-3 bg-red-50 rounded-lg border border-red-200">
                Could not fetch models. The provider may not support model discovery. You&apos;ll be able to enter a model ID manually on the next step.
              </div>
            )}

            {discoverMutation.isSuccess && (
              <>
                {Object.keys(groupedModels).length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                    No models returned by the provider. You can enter a model ID manually on the next step.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                    {Object.entries(groupedModels).map(([cap, models]) => (
                      <div key={cap}>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {cap}
                        </div>
                        <div className="space-y-1.5">
                          {models.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 text-sm"
                            >
                              <span className="font-mono text-xs flex-1 truncate">
                                {m.displayName || m.id}
                              </span>
                              {m.capability?.map((c) => (
                                <Badge
                                  key={c}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {c}
                                </Badge>
                              ))}
                              {m.contextWindow && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {(m.contextWindow / 1000).toFixed(0)}K ctx
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={goNext}
                disabled={discoverMutation.isPending}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        );

      // ── Step 3: Select model ─────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Select Model</h2>
              <p className="text-sm text-muted-foreground">
                Choose the primary model for this provider configuration.
              </p>
            </div>

            {wizardData.discoveredModels.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {wizardData.discoveredModels.map((m) => {
                  const isSelected = wizardData.selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setWizardData((prev) => ({
                          ...prev,
                          selectedModel: m.id,
                        }))
                      }
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50 hover:bg-muted/20"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm truncate">
                          {m.displayName || m.id}
                        </div>
                        {m.id !== m.displayName && m.displayName && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {m.id}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.capability?.map((c) => (
                          <Badge
                            key={c}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {c}
                          </Badge>
                        ))}
                        {m.contextWindow && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {(m.contextWindow / 1000).toFixed(0)}K
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                  No models returned — enter model ID manually.
                </p>
                <Label>Model ID</Label>
                <Input
                  placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022"
                  value={wizardData.selectedModel}
                  onChange={(e) =>
                    setWizardData((prev) => ({
                      ...prev,
                      selectedModel: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            {updateProviderMutation.isError && (
              <div className="text-sm text-red-700 p-3 bg-red-50 rounded-lg border border-red-200">
                Failed to save model selection. Please try again.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                disabled={!wizardData.selectedModel || updateProviderMutation.isPending}
                onClick={() => {
                  if (!wizardData.configId || !wizardData.selectedModel) return;
                  updateProviderMutation.mutate({
                    id: wizardData.configId,
                    data: { model: wizardData.selectedModel },
                  });
                }}
              >
                {updateProviderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save &amp; Continue
              </Button>
            </div>
          </div>
        );

      // ── Step 4: Benchmark ────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Benchmark</h2>
              <p className="text-sm text-muted-foreground">
                Run a benchmark to measure latency and response quality for{" "}
                <strong>{wizardData.selectedModel}</strong>.
              </p>
            </div>

            {benchmarkMutation.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-8 w-3/4 rounded-lg" />
                <Skeleton className="h-8 w-1/2 rounded-lg" />
                <p className="text-sm text-muted-foreground text-center">
                  Running benchmark…
                </p>
              </div>
            ) : wizardData.benchmarkResult ? (
              <Card>
                <CardContent className="pt-4">
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2 font-medium text-muted-foreground">TTFT</td>
                        <td className="py-2 text-right font-mono">
                          {wizardData.benchmarkResult.ttftMs}ms
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium text-muted-foreground">
                          Total latency
                        </td>
                        <td className="py-2 text-right font-mono">
                          {wizardData.benchmarkResult.totalLatencyMs}ms
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium text-muted-foreground">
                          Quality
                        </td>
                        <td className="py-2 text-right">
                          {QUALITY_LABELS[wizardData.benchmarkResult.qualityScore] ?? "Unknown"}
                          {wizardData.benchmarkResult.qualityScore >= 2 &&
                            wizardData.benchmarkResult.ttftMs < 2000 && (
                              <Badge className="ml-2 bg-green-100 text-green-800 border-0 text-[10px]">
                                <Zap className="h-3 w-3 mr-1" />
                                Recommended
                              </Badge>
                            )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-6 border-2 border-dashed rounded-xl">
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Run Benchmark" to test latency and quality.
                </p>
                <Button
                  variant="outline"
                  disabled={!wizardData.configId}
                  onClick={() => {
                    if (!wizardData.configId) return;
                    benchmarkMutation.mutate({
                      id: wizardData.configId,
                      data: { model: wizardData.selectedModel || undefined },
                    });
                  }}
                >
                  Run Benchmark
                </Button>
              </div>
            )}

            {benchmarkMutation.isError && (
              <div className="text-sm text-red-700 p-3 bg-red-50 rounded-lg border border-red-200">
                Benchmark failed. You can skip and continue.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="text-muted-foreground text-sm"
                  onClick={goNext}
                >
                  Skip
                </Button>
                <Button onClick={goNext} disabled={benchmarkMutation.isPending}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        );

      // ── Step 5: Routing assignment ──────────────────────────────────────
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">
                Routing Assignment
              </h2>
              <p className="text-sm text-muted-foreground">
                Assign models to each task type. Pre-filled from benchmark suggestions.
              </p>
            </div>

            {routingQuery.isLoading ? (
              <div className="space-y-3">
                {TASK_TYPES.map((t) => (
                  <Skeleton key={t} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {TASK_TYPES.map((taskType) => {
                  const suggestions = routingQuery.data?.suggestions ?? {};
                  const isSuggested =
                    suggestions[taskType] !== undefined &&
                    wizardData.routing[taskType] === suggestions[taskType];
                  const modelOptions =
                    wizardData.discoveredModels.length > 0
                      ? wizardData.discoveredModels
                      : wizardData.selectedModel
                      ? [
                          {
                            id: wizardData.selectedModel,
                            displayName: wizardData.selectedModel,
                          } as LlmDiscoveredModel,
                        ]
                      : [];

                  return (
                    <div
                      key={taskType}
                      className="flex items-center gap-3 p-3 rounded-xl border"
                    >
                      <div className="w-24 shrink-0">
                        <div className="text-sm font-medium">
                          {TASK_TYPE_LABELS[taskType]}
                        </div>
                        {isSuggested && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-700 border-amber-200 bg-amber-50 px-1.5 py-0 mt-0.5"
                          >
                            Auto-suggested
                          </Badge>
                        )}
                      </div>
                      <div className="flex-1">
                        {modelOptions.length > 0 ? (
                          <Select
                            value={wizardData.routing[taskType] ?? ""}
                            onValueChange={(v) =>
                              setWizardData((prev) => ({
                                ...prev,
                                routing: { ...prev.routing, [taskType]: v },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select model…" />
                            </SelectTrigger>
                            <SelectContent>
                              {modelOptions.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.displayName || m.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="h-8 text-xs"
                            placeholder="Model ID…"
                            value={wizardData.routing[taskType] ?? ""}
                            onChange={(e) =>
                              setWizardData((prev) => ({
                                ...prev,
                                routing: {
                                  ...prev.routing,
                                  [taskType]: e.target.value,
                                },
                              }))
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            {updateRoutingMutation.isError && (
              <div className="text-sm text-red-700 p-3 bg-red-50 rounded-lg border border-red-200">
                Failed to save routing. Please try again.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                disabled={updateRoutingMutation.isPending || !wizardData.configId}
                onClick={() => {
                  if (!wizardData.configId) return;
                  updateRoutingMutation.mutate({
                    data: {
                      entries: TASK_TYPES.map((t) => ({
                        taskType: t as "enrichment" | "triage" | "treatment" | "embeddings" | "agent" | "general",
                        configId: wizardData.configId ?? undefined,
                        modelOverride: wizardData.routing[t] || undefined,
                      })),
                    },
                  });
                }}
              >
                {updateRoutingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Finish
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full border-l overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Configure LLM Provider</SheetTitle>
        </SheetHeader>

        <Stepper
          currentStep={step}
          completedUpTo={completedUpTo}
          onStepClick={setStep}
        />

        <Separator className="mb-6" />

        <div className="transition-opacity duration-200">{renderStep()}</div>
      </SheetContent>
    </Sheet>
  );
}
