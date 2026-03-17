import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Upload, FileText, Loader2, ChevronDown, ChevronUp, CheckCircle,
  AlertCircle, ArrowRight, Lightbulb, AlertTriangle, X, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ProposedRisk {
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  rationale: string;
}

interface AdjustmentSuggestion {
  riskId: string | null;
  riskTitle: string;
  field: string;
  suggestedValue: string | number;
  rationale: string;
}

export interface ExtractedSignal {
  title: string;
  description: string;
}

interface DocumentAnalysisResult {
  documentName: string;
  documentSignalId: string | null;
  summary: string;
  proposedRisks: ProposedRisk[];
  adjustmentSuggestions: AdjustmentSuggestion[];
  extractedSignals: ExtractedSignal[];
}

export interface PopulateFormPayload {
  risk: ProposedRisk;
  documentSignalId: string | null;
}

interface DocumentAnalysisPanelProps {
  onPopulateForm: (payload: PopulateFormPayload) => void;
  onTextExtracted?: (text: string) => void;
}

const ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "txt", "md", "csv"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function isValidFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" is not a supported format.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 20 MB limit.`;
  }
  return null;
}

function FileItem({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/60 rounded-md text-xs">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate">{name}</span>
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ProposedRiskCard({
  risk,
  documentSignalId,
  onPopulate,
}: {
  risk: ProposedRisk;
  documentSignalId: string | null;
  onPopulate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2">{risk.title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className="text-[10px] capitalize">{risk.category}</Badge>
            <span className="text-[10px] text-muted-foreground font-mono">L{risk.likelihood}×I{risk.impact}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" className="text-xs h-7 px-2 shrink-0" onClick={onPopulate}>
          Populate form
        </Button>
      </div>
      {expanded && (
        <div className="space-y-1.5 pt-1 border-t">
          <p className="text-xs text-muted-foreground">{risk.description}</p>
          {risk.rationale && (
            <p className="text-[11px] text-muted-foreground italic">{risk.rationale}</p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Less" : "Details"}
      </button>
    </div>
  );
}

function AdjustmentCard({ suggestion }: { suggestion: AdjustmentSuggestion }) {
  const [, navigate] = useLocation();
  return (
    <div className="border rounded-lg p-3 space-y-1.5 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">{suggestion.riskTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Update: <span className="font-medium">{suggestion.field}</span>
            {suggestion.suggestedValue !== undefined && (
              <> → <span className="font-medium">{String(suggestion.suggestedValue)}</span></>
            )}
          </p>
        </div>
        {suggestion.riskId && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 shrink-0"
            onClick={() => navigate(`/risks/${suggestion.riskId}`)}
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Go to risk
          </Button>
        )}
      </div>
      {suggestion.rationale && (
        <p className="text-[11px] text-muted-foreground italic">{suggestion.rationale}</p>
      )}
    </div>
  );
}

function SignalCard({
  signal,
  documentName,
}: {
  signal: ExtractedSignal;
  documentName: string;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/v1/documents/save-signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: signal.title,
          description: signal.description,
          documentName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Save failed" }));
        throw new Error(err.detail || err.message || `Error ${res.status}`);
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [signal, documentName]);

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{signal.title}</p>
          {signal.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{signal.description}</p>
          )}
        </div>
        <Button
          size="sm"
          variant={saved ? "secondary" : "outline"}
          className="text-xs h-7 px-2 shrink-0"
          disabled={saving || saved}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : saved ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-3 w-3 mr-1" />
              Save as signal
            </>
          )}
        </Button>
      </div>
      {saveError && (
        <p className="text-[10px] text-destructive">{saveError}</p>
      )}
    </div>
  );
}

function AnalysisResults({
  results,
  onPopulateForm,
}: {
  results: DocumentAnalysisResult[];
  onPopulateForm: (payload: PopulateFormPayload) => void;
}) {
  return (
    <div className="space-y-4">
      {results.map((r, i) => (
        <div key={i} className="p-3 rounded-lg bg-muted/40 border text-xs">
          <p className="font-semibold text-foreground mb-1 truncate">{r.documentName}</p>
          <p className="text-muted-foreground">{r.summary}</p>
        </div>
      ))}

      {results.some(r => r.proposedRisks.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">
              Proposed Risks ({results.reduce((sum, r) => sum + r.proposedRisks.length, 0)})
            </span>
          </div>
          {results.flatMap((r) =>
            r.proposedRisks.map((risk, j) => (
              <ProposedRiskCard
                key={`${r.documentName}-${j}`}
                risk={risk}
                documentSignalId={r.documentSignalId}
                onPopulate={() => onPopulateForm({ risk, documentSignalId: r.documentSignalId })}
              />
            ))
          )}
        </div>
      )}

      {results.some(r => r.adjustmentSuggestions.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-semibold">
              Suggested Updates ({results.reduce((sum, r) => sum + r.adjustmentSuggestions.length, 0)})
            </span>
          </div>
          {results.flatMap((r) =>
            r.adjustmentSuggestions.map((s, j) => (
              <AdjustmentCard key={`${r.documentName}-adj-${j}`} suggestion={s} />
            ))
          )}
        </div>
      )}

      {results.some(r => r.extractedSignals.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold">
              Extracted Signals ({results.reduce((sum, r) => sum + r.extractedSignals.length, 0)})
            </span>
          </div>
          {results.flatMap((r) =>
            r.extractedSignals.map((s, j) => (
              <SignalCard key={`${r.documentName}-sig-${j}`} signal={s} documentName={r.documentName} />
            ))
          )}
        </div>
      )}

      {results.every(r => r.proposedRisks.length === 0 && r.adjustmentSuggestions.length === 0 && r.extractedSignals.length === 0) && (
        <div className="text-center py-4 text-muted-foreground">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-40" />
          <p className="text-xs">No risk-relevant information found in the uploaded documents.</p>
        </div>
      )}
    </div>
  );
}

export function DocumentAnalysisPanel({ onPopulateForm, onTextExtracted }: DocumentAnalysisPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [results, setResults] = useState<DocumentAnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of newFiles) {
      const err = isValidFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    }
    if (errors.length) setError(errors.join(" "));
    else setError(null);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
  }, []);

  const removeFile = useCallback((name: string) => {
    setFiles(prev => prev.filter(f => f.name !== name));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  }, [addFiles]);

  const handleAnalyse = useCallback(async () => {
    if (!files.length) return;
    setIsAnalysing(true);
    setError(null);
    try {
      const token = localStorage.getItem("accessToken");
      const formData = new FormData();
      for (const f of files) formData.append("files", f);

      const res = await fetch("/api/v1/documents/analyze-for-risk", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Analysis failed" }));
        throw new Error(errData.detail || errData.message || `Error ${res.status}`);
      }

      const data = await res.json() as { results: DocumentAnalysisResult[] };
      setResults(prev => [...prev, ...data.results]);

      if (onTextExtracted) {
        const textParts = data.results
          .filter(r => r.summary && r.summary !== "Document appears to be empty or contains no extractable text.")
          .map(r => `[${r.documentName}]\n${r.summary}\n${r.proposedRisks.map(p => `Risk: ${p.title} — ${p.description}`).join("\n")}`)
          .filter(Boolean);
        if (textParts.length > 0) {
          onTextExtracted(textParts.join("\n\n"));
        }
      }

      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalysing(false);
    }
  }, [files, onTextExtracted]);

  const totalProposed = results.reduce((sum, r) => sum + r.proposedRisks.length, 0);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv"
          className="hidden"
          onChange={handleFileInput}
        />
        <Upload className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
        <p className="text-xs font-medium">Drop files here or click to browse</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          PDF, DOCX, XLSX, PPTX, MD, TXT, CSV · up to 20 MB each
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map(f => (
            <FileItem key={f.name} name={f.name} onRemove={() => removeFile(f.name)} />
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {files.length > 0 && (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={isAnalysing}
          onClick={handleAnalyse}
        >
          {isAnalysing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Analyse {files.length === 1 ? "document" : `${files.length} documents`}
            </>
          )}
        </Button>
      )}

      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Analysis Results</span>
            {totalProposed > 0 && (
              <span className="text-[10px] text-muted-foreground">{totalProposed} risk{totalProposed !== 1 ? "s" : ""} found</span>
            )}
          </div>
          <ScrollArea className="max-h-[380px]">
            <div className="pr-2">
              <AnalysisResults results={results} onPopulateForm={onPopulateForm} />
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
