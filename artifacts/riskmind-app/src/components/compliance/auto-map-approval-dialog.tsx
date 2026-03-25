import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AutoMapSuggestion {
  requirementId: string;
  code: string;
  title: string;
  frameworkId: string;
  similarity: number;
}

interface AutoMapApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
  controlTitle: string;
  existingRequirementIds: string[];
  onSuccess: () => void;
}

export function AutoMapApprovalDialog({
  open,
  onOpenChange,
  controlId,
  controlTitle,
  existingRequirementIds,
  onSuccess,
}: AutoMapApprovalDialogProps) {
  const [suggestions, setSuggestions] = useState<AutoMapSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch suggestions when dialog opens
  useEffect(() => {
    if (!open || !controlId) return;

    setSuggestions([]);
    setSelected(new Set());
    setFetchError(null);
    setLoading(true);

    fetch(`/api/v1/controls/${controlId}/auto-map-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
        }
        return res.json() as Promise<{ suggestions: AutoMapSuggestion[] }>;
      })
      .then(({ suggestions: s }) => {
        setSuggestions(s);
        // Pre-check suggestions with similarity > 0.8
        const autoSelected = new Set(
          s.filter((item) => item.similarity > 0.8).map((item) => item.requirementId)
        );
        setSelected(autoSelected);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Failed to load suggestions");
      })
      .finally(() => setLoading(false));
  }, [open, controlId]);

  const toggleSelection = (requirementId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(requirementId)) {
        next.delete(requirementId);
      } else {
        next.add(requirementId);
      }
      return next;
    });
  };

  const handleApply = async () => {
    if (selected.size === 0) return;
    setApplying(true);

    // Merge selected new IDs with existing ones (deduplicated)
    const merged = Array.from(new Set([...existingRequirementIds, ...selected]));

    try {
      const res = await fetch(`/api/v1/controls/${controlId}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementIds: merged }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
      }

      toast({
        title: "Mappings applied",
        description: `${selected.size} requirement${selected.size !== 1 ? "s" : ""} mapped to ${controlTitle}.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Failed to apply mappings",
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setApplying(false);
    }
  };

  const similarityPercent = (sim: number) => Math.round(sim * 100);

  const getSimilarityColor = (sim: number) => {
    if (sim >= 0.85) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    if (sim >= 0.7) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  // Group suggestions by frameworkId to show framework name header when multiple frameworks
  const frameworkIds = Array.from(new Set(suggestions.map((s) => s.frameworkId)));
  const multiFramework = frameworkIds.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Requirement Suggestions
          </DialogTitle>
          <DialogDescription>
            Select requirements to map to <span className="font-medium text-foreground">{controlTitle}</span>.
            High-confidence matches are pre-selected.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[200px] max-h-[400px] overflow-y-auto -mx-6 px-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Searching for matching requirements...</span>
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Info className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Could not load suggestions</p>
                <p className="text-sm text-muted-foreground mt-1">{fetchError}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Ensure an embeddings provider is configured in Settings.
                </p>
              </div>
            </div>
          )}

          {!loading && !fetchError && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">No matching requirements found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adding more requirements or configuring an embeddings provider.
                </p>
              </div>
            </div>
          )}

          {!loading && !fetchError && suggestions.length > 0 && (
            <div className="space-y-1 py-2">
              {suggestions.map((suggestion) => {
                const isChecked = selected.has(suggestion.requirementId);
                const isExisting = existingRequirementIds.includes(suggestion.requirementId);

                return (
                  <div
                    key={suggestion.requirementId}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer",
                      isChecked ? "bg-violet-50 dark:bg-violet-950/30" : "hover:bg-muted/50",
                      isExisting && "opacity-50"
                    )}
                    onClick={() => !isExisting && toggleSelection(suggestion.requirementId)}
                  >
                    <Checkbox
                      checked={isChecked || isExisting}
                      disabled={isExisting}
                      onCheckedChange={() => !isExisting && toggleSelection(suggestion.requirementId)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold bg-secondary px-1.5 py-0.5 rounded border shrink-0">
                          {suggestion.code}
                        </span>
                        <span className="text-sm font-medium truncate">{suggestion.title}</span>
                      </div>
                      {multiFramework && (
                        <span className="text-xs text-muted-foreground mt-0.5 block">
                          Framework: {suggestion.frameworkId}
                        </span>
                      )}
                      {isExisting && (
                        <span className="text-xs text-muted-foreground mt-0.5 block">Already mapped</span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold shrink-0",
                        getSimilarityColor(suggestion.similarity)
                      )}
                    >
                      {similarityPercent(suggestion.similarity)}% match
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && !fetchError && suggestions.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {selected.size} of {suggestions.length} suggestions selected
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying || loading || selected.size === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {applying ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            Apply Selected ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
