import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface RawRequirement {
  code: string;
  title: string;
  description?: string;
  parentCode?: string;
  [key: string]: unknown;
}

interface DiffEntry {
  incoming: RawRequirement;
  existing: RawRequirement;
}

interface DiffResult {
  new: RawRequirement[];
  modified: DiffEntry[];
  unchanged: RawRequirement[];
}

interface ImportResult {
  imported: { new: number; modified: number; unchanged: number };
  warnings: string[];
}

type Step = "upload" | "preview" | "done";
type Format = "csv" | "json";

interface ImportFrameworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frameworkId: string;
  onSuccess: () => void;
}

export function ImportFrameworkDialog({ open, onOpenChange, frameworkId, onSuccess }: ImportFrameworkDialogProps) {
  const [format, setFormat] = useState<Format>("csv");
  const [file, setFile] = useState<File | null>(null);
  const [diffResult, setDiffResult] = useState<{ diff: DiffResult; warnings: string[]; totalIncoming: number } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplyLoading, setIsApplyLoading] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [showUnchanged, setShowUnchanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setFormat("csv");
    setFile(null);
    setDiffResult(null);
    setImportResult(null);
    setIsPreviewLoading(false);
    setIsApplyLoading(false);
    setStep("upload");
    setShowUnchanged(false);
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetState();
    onOpenChange(open);
  }

  async function handlePreview() {
    if (!file) {
      toast({ variant: "destructive", title: "Please select a file to import." });
      return;
    }
    setIsPreviewLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/frameworks/${frameworkId}/import/preview?format=${format}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Preview failed" }));
        throw new Error(err.message || "Preview failed");
      }
      const data = await res.json();
      setDiffResult(data);
      setStep("preview");
    } catch (err) {
      toast({ variant: "destructive", title: (err as Error).message || "Failed to preview import." });
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleApply() {
    if (!file) return;
    setIsApplyLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/frameworks/${frameworkId}/import/apply?format=${format}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Apply failed" }));
        throw new Error(err.message || "Apply failed");
      }
      const data: ImportResult = await res.json();
      setImportResult(data);
      toast({ title: `Import complete: ${data.imported.new} new, ${data.imported.modified} modified.` });
      setStep("done");
      onSuccess();
    } catch (err) {
      toast({ variant: "destructive", title: (err as Error).message || "Failed to apply import." });
    } finally {
      setIsApplyLoading(false);
    }
  }

  const diff = diffResult?.diff;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto flex flex-col">
        <SheetHeader className="mb-6">
          <SheetTitle>Import Framework Controls</SheetTitle>
          <SheetDescription>
            Upload a CSV or JSON file containing requirements/controls to import into this framework.
          </SheetDescription>
        </SheetHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-6 flex-1">
            {/* Format toggle */}
            <div>
              <label className="text-sm font-medium mb-2 block">File Format</label>
              <div className="flex gap-2">
                {(["csv", "json"] as Format[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      format === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* File input */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select File</label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                  file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium">Click to select file</span>
                    <span className="text-xs text-muted-foreground">Accepts .csv and .json files</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </div>

            <Button
              onClick={handlePreview}
              disabled={!file || isPreviewLoading}
              className="w-full"
            >
              {isPreviewLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                "Preview Changes"
              )}
            </Button>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && diff && (
          <div className="space-y-4 flex-1 flex flex-col">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300">
                {diff.new.length} new
              </Badge>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300">
                {diff.modified.length} modified
              </Badge>
              <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300">
                {diff.unchanged.length} unchanged
              </Badge>
            </div>

            {/* Warnings */}
            {diffResult?.warnings && diffResult.warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </div>
                {diffResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400 pl-5">{w}</p>
                ))}
              </div>
            )}

            {/* Change list */}
            <div className="flex-1 overflow-y-auto border rounded-xl divide-y max-h-[50vh]">
              {/* New requirements */}
              {diff.new.map((req, i) => (
                <div key={`new-${i}`} className="flex items-start gap-3 p-3 border-l-4 border-l-emerald-500">
                  <span className="text-xs font-bold text-emerald-600 w-12 shrink-0 pt-0.5">NEW</span>
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold bg-secondary px-1.5 py-0.5 rounded border mr-2">{req.code}</span>
                    <span className="text-sm">{req.title}</span>
                  </div>
                </div>
              ))}

              {/* Modified requirements */}
              {diff.modified.map((entry, i) => (
                <div key={`mod-${i}`} className="flex items-start gap-3 p-3 border-l-4 border-l-amber-500">
                  <span className="text-xs font-bold text-amber-600 w-12 shrink-0 pt-0.5">MOD</span>
                  <div className="min-w-0 space-y-1">
                    <div>
                      <span className="font-mono text-xs font-bold bg-secondary px-1.5 py-0.5 rounded border mr-2">{entry.incoming.code}</span>
                      <span className="text-sm">{entry.incoming.title}</span>
                    </div>
                    {entry.existing.title !== entry.incoming.title && (
                      <div className="text-xs text-muted-foreground">
                        <span className="line-through">{entry.existing.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Unchanged (collapsed by default) */}
              {diff.unchanged.length > 0 && (
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 p-3 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                    onClick={() => setShowUnchanged(!showUnchanged)}
                  >
                    <span>{showUnchanged ? "Hide" : "Show"} {diff.unchanged.length} unchanged</span>
                  </button>
                  {showUnchanged && diff.unchanged.map((req, i) => (
                    <div key={`unch-${i}`} className="flex items-start gap-3 p-3 border-l-4 border-l-gray-200 bg-muted/10">
                      <span className="text-xs font-bold text-muted-foreground w-12 shrink-0 pt-0.5">—</span>
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold bg-secondary px-1.5 py-0.5 rounded border mr-2 opacity-60">{req.code}</span>
                        <span className="text-sm text-muted-foreground">{req.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {diff.new.length === 0 && diff.modified.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No changes detected.</div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleApply} disabled={isApplyLoading} className="flex-1">
                {isApplyLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying...</>
                ) : (
                  "Apply Import"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && importResult && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">Import Complete</h3>
              <p className="text-sm text-muted-foreground">Framework controls have been updated successfully.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <div className="text-center px-4 py-2 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="text-2xl font-bold text-emerald-600">{importResult.imported.new}</div>
                <div className="text-xs text-emerald-700 dark:text-emerald-400">Added</div>
              </div>
              <div className="text-center px-4 py-2 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="text-2xl font-bold text-amber-600">{importResult.imported.modified}</div>
                <div className="text-xs text-amber-700 dark:text-amber-400">Updated</div>
              </div>
              <div className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-gray-500">{importResult.imported.unchanged}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Unchanged</div>
              </div>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
