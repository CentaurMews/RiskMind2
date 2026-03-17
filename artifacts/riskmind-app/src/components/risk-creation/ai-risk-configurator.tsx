import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wand2,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export interface ConfiguratorScenario {
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  sources: string[];
}

interface ScenarioCardState {
  scenario: ConfiguratorScenario;
  status: "pending" | "recording" | "saving" | "recorded" | "drafted" | "dismissed" | "error";
  savedId?: string;
  error?: string;
}

export interface AiRiskConfiguratorProps {
  documentText?: string;
  onPopulateForm?: (scenario: ConfiguratorScenario) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  operational: "bg-orange-50 text-orange-700 border-orange-200",
  financial: "bg-green-50 text-green-700 border-green-200",
  compliance: "bg-purple-50 text-purple-700 border-purple-200",
  strategic: "bg-blue-50 text-blue-700 border-blue-200",
  technology: "bg-cyan-50 text-cyan-700 border-cyan-200",
  reputational: "bg-rose-50 text-rose-700 border-rose-200",
};

function LikelihoodImpactBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 4 ? "text-red-600 bg-red-50 border-red-200" :
    value >= 3 ? "text-amber-600 bg-amber-50 border-amber-200" :
    "text-emerald-600 bg-emerald-50 border-emerald-200";
  return (
    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold", color)}>
      {label} {value}/5
    </span>
  );
}

function ScenarioCard({
  state,
  onRecord,
  onDraft,
  onDismiss,
  onPopulateForm,
}: {
  state: ScenarioCardState;
  onRecord: () => void;
  onDraft: () => void;
  onDismiss: () => void;
  onPopulateForm?: (scenario: ConfiguratorScenario) => void;
}) {
  const { scenario, status, savedId, error } = state;
  const catColor = CATEGORY_COLORS[scenario.category] || "bg-muted text-foreground border-border";
  const isDone = status === "recorded" || status === "drafted" || status === "dismissed";
  const isLoading = status === "recording" || status === "saving";

  if (status === "dismissed") return null;

  return (
    <div className={cn(
      "border rounded-xl p-3 space-y-2.5 transition-all",
      isDone ? "bg-muted/30 opacity-80" : "bg-card hover:border-primary/30"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug">{scenario.title}</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize", catColor)}>
              {scenario.category}
            </span>
            <LikelihoodImpactBadge label="L" value={scenario.likelihood} />
            <LikelihoodImpactBadge label="I" value={scenario.impact} />
          </div>
        </div>
        {!isDone && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {status === "recorded" && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />}
        {status === "drafted" && <Badge variant="secondary" className="text-[10px] shrink-0">Draft</Badge>}
      </div>

      {scenario.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{scenario.description}</p>
      )}

      {scenario.sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scenario.sources.map((src, i) => (
            <span key={i} className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground">
              {src}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[10px] text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      {(status === "recorded" || status === "drafted") && savedId && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {status === "recorded" ? "Recorded." : "Saved as draft."}
          </p>
          <Link href={`/risks/${savedId}`}>
            <button type="button" className="text-[11px] text-primary underline underline-offset-2 flex items-center gap-0.5">
              View <ExternalLink className="h-2.5 w-2.5" />
            </button>
          </Link>
        </div>
      )}

      {!isDone && (
        <div className="space-y-1.5 pt-0.5">
          {onPopulateForm && (
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => onPopulateForm(scenario)}
              disabled={isLoading}
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              Use this — fill form
            </Button>
          )}
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant={onPopulateForm ? "outline" : "default"} onClick={onRecord} disabled={isLoading} className="flex-1 text-xs">
              {status === "recording" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Record
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDraft} disabled={isLoading} className="flex-1 text-xs">
              {status === "saving" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Draft
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AiRiskConfigurator({ documentText, onPopulateForm }: AiRiskConfiguratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioCardState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const queryClient = useQueryClient();

  const handleRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setScenarios([]);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/v1/ai/risk-configurator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ documentText: documentText || undefined }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Analysis failed" }));
        throw new Error(errData.detail || errData.message || `Error ${res.status}`);
      }
      const data = await res.json() as { scenarios: ConfiguratorScenario[] };
      setScenarios(data.scenarios.map(s => ({ scenario: s, status: "pending" })));
      setHasRun(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyse context");
    } finally {
      setIsLoading(false);
    }
  }, [documentText]);

  const saveScenario = useCallback(async (index: number, saveAsDraft: boolean) => {
    const state = scenarios[index];
    if (!state) return;

    setScenarios(prev => prev.map((s, i) =>
      i === index ? { ...s, status: saveAsDraft ? "saving" : "recording", error: undefined } : s
    ));

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/v1/ai/risk-configurator/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: state.scenario.title,
          description: state.scenario.description,
          category: state.scenario.category,
          likelihood: state.scenario.likelihood,
          impact: state.scenario.impact,
          saveAsDraft,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Save failed" }));
        throw new Error(errData.detail || errData.message || `Error ${res.status}`);
      }
      const data = await res.json() as { risk: { id: string } };
      setScenarios(prev => prev.map((s, i) =>
        i === index ? { ...s, status: saveAsDraft ? "drafted" : "recorded", savedId: data.risk.id } : s
      ));
      queryClient.invalidateQueries({ queryKey: ["/api/v1/risks"] });
    } catch (err) {
      setScenarios(prev => prev.map((s, i) =>
        i === index ? { ...s, status: "error", error: err instanceof Error ? err.message : "Save failed" } : s
      ));
    }
  }, [scenarios, queryClient]);

  const dismissScenario = useCallback((index: number) => {
    setScenarios(prev => prev.map((s, i) =>
      i === index ? { ...s, status: "dismissed" } : s
    ));
  }, []);

  const visibleScenarios = scenarios.filter(s => s.status !== "dismissed");

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full border-primary/40 text-primary hover:bg-primary/5"
        onClick={handleRun}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analysing signals &amp; findings…
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4 mr-2" />
            {hasRun ? "Re-scan with AI" : "Scan for risks with AI"}
          </>
        )}
      </Button>

      {error && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {hasRun && !isLoading && visibleScenarios.length === 0 && scenarios.length > 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">All scenarios processed.</p>
      )}

      {hasRun && !isLoading && scenarios.length === 0 && !error && (
        <div className="text-center py-4 text-muted-foreground">
          <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-40" />
          <p className="text-xs">No scenarios identified from available context.</p>
          <p className="text-[10px] mt-1">Add signals, findings, or upload a document to improve results.</p>
        </div>
      )}

      {visibleScenarios.length > 0 && (
        <ScrollArea className="max-h-[420px]">
          <div className="space-y-2.5 pr-1">
            {scenarios.map((state, i) =>
              state.status !== "dismissed" ? (
                <ScenarioCard
                  key={i}
                  state={state}
                  onRecord={() => saveScenario(i, false)}
                  onDraft={() => saveScenario(i, true)}
                  onDismiss={() => dismissScenario(i)}
                  onPopulateForm={onPopulateForm}
                />
              ) : null
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
