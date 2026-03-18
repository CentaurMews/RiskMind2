import { useState } from "react";
import {
  useGetLlmRouting,
  useUpdateLlmRouting,
  useListLlmProviders,
} from "@workspace/api-client-react";
import type { LlmRoutingEntry } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, CheckCircle2, Loader2, Route } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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

// ─── Component ────────────────────────────────────────────────────────────────

export function RoutingTableCard({ tenantId }: { tenantId: string }) {
  void tenantId; // used for context; routing is tenant-scoped server-side
  const queryClient = useQueryClient();

  const routingQuery = useGetLlmRouting({
    query: { queryKey: ["/api/v1/settings/llm-routing"] },
  });

  const { data: providers } = useListLlmProviders({
    query: { queryKey: ["/api/v1/settings/llm-providers"] },
  });

  const updateRoutingMutation = useUpdateLlmRouting({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["/api/v1/settings/llm-routing"],
        });
        setEditingRow(null);
      },
    },
  });

  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const entries: LlmRoutingEntry[] = routingQuery.data?.entries ?? [];
  const suggestions = routingQuery.data?.suggestions ?? {};

  const getEntryForTaskType = (taskType: string): LlmRoutingEntry | undefined =>
    entries.find((e) => e.taskType === taskType);

  const providerList = Array.isArray(providers) ? providers : [];

  const handleSaveEdit = (taskType: string) => {
    // Find the existing entries for all task types, update just this one
    const allEntries = TASK_TYPES.map((t) => {
      const existing = getEntryForTaskType(t);
      if (t === taskType) {
        // Find the provider for editValue (config ID)
        return {
          taskType: t as "enrichment" | "triage" | "treatment" | "embeddings" | "agent" | "general",
          configId: editValue || undefined,
          modelOverride: existing?.modelOverride ?? undefined,
        };
      }
      return {
        taskType: t as "enrichment" | "triage" | "treatment" | "embeddings" | "agent" | "general",
        configId: existing?.configId ?? undefined,
        modelOverride: existing?.modelOverride ?? undefined,
      };
    });

    updateRoutingMutation.mutate({ data: { entries: allEntries } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" /> Model Routing
        </CardTitle>
        <CardDescription>
          Per-task model assignments. Each AI task type can use a different
          provider and model for optimal performance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {routingQuery.isLoading ? (
          <div className="space-y-3">
            {TASK_TYPES.map((t) => (
              <Skeleton key={t} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 && providerList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Route className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No routing configured yet. Complete the LLM Config Wizard to assign
            models to each task type.
          </div>
        ) : (
          <div className="space-y-2">
            {TASK_TYPES.map((taskType) => {
              const entry = getEntryForTaskType(taskType);
              const suggestion = suggestions[taskType];
              const isAutoSuggested =
                suggestion !== undefined &&
                entry?.effectiveModel === suggestion;
              const isEditing = editingRow === taskType;

              return (
                <div
                  key={taskType}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/10 transition-colors"
                >
                  {/* Task type label */}
                  <div className="w-28 shrink-0">
                    <div className="text-sm font-medium">
                      {TASK_TYPE_LABELS[taskType]}
                    </div>
                    {isAutoSuggested && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-700 border-amber-200 bg-amber-50 px-1.5 py-0 mt-0.5"
                      >
                        Auto-suggested
                      </Badge>
                    )}
                  </div>

                  {/* Model info / edit */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <Select
                        value={editValue}
                        onValueChange={setEditValue}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select provider…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— default —</SelectItem>
                          {providerList.map((p) => (
                            <SelectItem key={p.id!} value={p.id!}>
                              {p.name} ({p.model})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono truncate">
                          {entry?.effectiveModel ?? "— default —"}
                        </span>
                        {entry?.providerName && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-muted-foreground"
                          >
                            {entry.providerName}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={updateRoutingMutation.isPending}
                          onClick={() => handleSaveEdit(taskType)}
                        >
                          {updateRoutingMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => setEditingRow(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Change assignment"
                        onClick={() => {
                          setEditingRow(taskType);
                          setEditValue(entry?.configId ?? "");
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
