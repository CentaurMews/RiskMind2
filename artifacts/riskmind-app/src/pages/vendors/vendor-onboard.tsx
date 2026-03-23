import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  Upload,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Identity & Tier",
  "Questionnaire",
  "Documents",
  "AI Enrichment",
];

const TIERS = ["critical", "high", "medium", "low"] as const;
type Tier = (typeof TIERS)[number];

const TIER_COLORS: Record<Tier, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-yellow-500",
  low: "bg-emerald-500",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AssessmentTemplate {
  id: string;
  name: string;
  description?: string | null;
  questions?: unknown[];
}

interface UploadedFile {
  id: string;
  filename: string;
  size: number;
}

interface SubprocessorCandidate {
  name: string;
  relationshipType: string;
  selected: boolean;
}

interface EnrichmentData {
  industry?: string;
  riskIndicators?: string;
  breachHistory?: string;
  descriptionEnrichment?: string;
}

// ─── Step 1: Identity + Tier ──────────────────────────────────────────────────

interface Step1Data {
  name: string;
  description: string;
  category: string;
  contactEmail: string;
  contactName: string;
  tier: Tier;
}

interface Step1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onContinue: () => void;
  isLoading: boolean;
}

function Step1Form({ data, onChange, onContinue, isLoading }: Step1Props) {
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleContinue = () => {
    let valid = true;
    if (!data.name.trim()) {
      setNameError("Vendor name is required.");
      valid = false;
    } else {
      setNameError("");
    }
    if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError("");
    }
    if (valid) onContinue();
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="vendor-name">
          Vendor Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="vendor-name"
          placeholder="Acme Corp"
          value={data.name}
          onChange={(e) => {
            onChange({ ...data, name: e.target.value });
            if (e.target.value.trim()) setNameError("");
          }}
          aria-invalid={!!nameError}
        />
        {nameError && (
          <p className="text-sm text-destructive">{nameError}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vendor-description">Description</Label>
        <Textarea
          id="vendor-description"
          rows={3}
          placeholder="Brief description of this vendor and the services they provide..."
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vendor-category">Category</Label>
        <Input
          id="vendor-category"
          placeholder="Cloud Hosting, Payment Processor..."
          value={data.category}
          onChange={(e) => onChange({ ...data, category: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vendor-email">Primary Contact Email</Label>
        <Input
          id="vendor-email"
          type="email"
          placeholder="security@acme.com"
          value={data.contactEmail}
          onChange={(e) => {
            onChange({ ...data, contactEmail: e.target.value });
            if (!e.target.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) setEmailError("");
          }}
          aria-invalid={!!emailError}
        />
        {emailError && (
          <p className="text-sm text-destructive">{emailError}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vendor-contact">Contact Name</Label>
        <Input
          id="vendor-contact"
          placeholder="Jane Smith"
          value={data.contactName}
          onChange={(e) => onChange({ ...data, contactName: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vendor-tier">Risk Tier</Label>
        <Select
          value={data.tier}
          onValueChange={(v) => onChange({ ...data, tier: v as Tier })}
        >
          <SelectTrigger id="vendor-tier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIERS.map((t) => (
              <SelectItem key={t} value={t}>
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", TIER_COLORS[t])} />
                  <span className="capitalize">{t}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleContinue} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Continue <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Questionnaire ────────────────────────────────────────────────────

interface Step2Props {
  vendorId: string;
  selectedTemplateId: string | null;
  onSelect: (id: string | null) => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading: boolean;
}

function Step2Form({ selectedTemplateId, onSelect, onContinue, onBack, isLoading }: Step2Props) {
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    setLoadingTemplates(true);
    fetch("/api/v1/assessment-templates", {
      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <p className="text-sm text-muted-foreground">
          Select a template to create an assessment for this vendor. You can complete it after onboarding.
        </p>
      </div>

      {loadingTemplates ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <p className="font-semibold text-sm">No Templates Available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create an assessment template in Settings before assigning one here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {templates.map((t) => {
            const isSelected = selectedTemplateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(isSelected ? null : t.id)}
                className={cn(
                  "text-left p-4 rounded-xl border-2 transition-all",
                  isSelected
                    ? "border-primary ring-1 ring-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/20"
                )}
              >
                <p className="font-semibold text-sm">{t.name}</p>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.description}
                  </p>
                )}
                {Array.isArray(t.questions) && (
                  <Badge variant="secondary" className="text-[10px] mt-2">
                    {t.questions.length} questions
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="text-sm text-muted-foreground underline"
        onClick={() => { onSelect(null); onContinue(); }}
      >
        Skip for now
      </button>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={onContinue} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Continue <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Document Upload ──────────────────────────────────────────────────

interface Step3Props {
  vendorId: string;
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  subprocessorCandidates: SubprocessorCandidate[];
  onCandidatesChange: (c: SubprocessorCandidate[]) => void;
  onContinue: () => void;
  onBack: () => void;
}

function Step3Form({
  vendorId,
  uploadedFiles,
  onFilesChange,
  subprocessorCandidates,
  onCandidatesChange,
  onContinue,
  onBack,
}: Step3Props) {
  const [uploading, setUploading] = useState(false);
  const [savingSubprocessors, setSavingSubprocessors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!validTypes.includes(file.type)) {
      toast({ variant: "destructive", title: "Upload failed. Check file type (PDF, DOCX, TXT) and try again." });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("filename", file.name);
      formData.append("fileSize", String(file.size));
      formData.append("mimeType", file.type);

      const res = await fetch(`/api/v1/vendors/${vendorId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        // Attempt JSON parse for error message
        let msg = "Upload failed. Check file type (PDF, DOCX, TXT) and try again.";
        try { msg = JSON.parse(text)?.message || msg; } catch { /* ignore */ }
        toast({ variant: "destructive", title: msg });
        return;
      }

      const doc = await res.json();
      const newFile: UploadedFile = {
        id: doc.id,
        filename: doc.filename || file.name,
        size: doc.fileSize || file.size,
      };
      onFilesChange([...uploadedFiles, newFile]);

      // After upload, try to extract subprocessors
      try {
        const extractRes = await fetch(`/api/v1/vendors/${vendorId}/extract-subprocessors`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ documentId: doc.id }),
        });
        if (extractRes.ok) {
          const extracted = await extractRes.json();
          const candidates = Array.isArray(extracted?.candidates) ? extracted.candidates : [];
          onCandidatesChange(
            candidates.map((c: { name: string; relationshipType?: string }) => ({
              name: c.name,
              relationshipType: c.relationshipType || "third-party",
              selected: false,
            }))
          );
        }
      } catch { /* subprocessor extraction is optional */ }
    } catch {
      toast({ variant: "destructive", title: "Upload failed. Check file type (PDF, DOCX, TXT) and try again." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (id: string) => {
    onFilesChange(uploadedFiles.filter((f) => f.id !== id));
  };

  const handleSaveSubprocessors = async () => {
    const selected = subprocessorCandidates.filter((c) => c.selected);
    if (selected.length === 0) return;

    setSavingSubprocessors(true);
    for (const c of selected) {
      try {
        await fetch(`/api/v1/vendors/${vendorId}/subprocessors`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: c.name, relationshipType: c.relationshipType }),
        });
      } catch { /* continue for remaining */ }
    }
    setSavingSubprocessors(false);
    onCandidatesChange([]);
    toast({ title: "Subprocessors saved." });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Upload area */}
      <div
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && fileInputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInputRef.current.files = dt.files;
            fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading ? (
          <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
        )}
        <p className="mt-2 text-sm font-medium">
          {uploading ? "Uploading..." : "Upload vendor documents"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT</p>
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploadedFiles.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="text-sm">{f.filename}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatSize(f.size)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveFile(f.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Subprocessor suggestions */}
      {subprocessorCandidates.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Suggested Subprocessors</span>
            </div>
            <div className="space-y-2">
              {subprocessorCandidates.map((c, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`sp-${idx}`}
                    checked={c.selected}
                    onChange={(e) => {
                      const updated = [...subprocessorCandidates];
                      updated[idx] = { ...c, selected: e.target.checked };
                      onCandidatesChange(updated);
                    }}
                    className="h-4 w-4"
                  />
                  <label htmlFor={`sp-${idx}`} className="text-sm flex-1">
                    {c.name}
                    <span className="text-xs text-muted-foreground ml-2">{c.relationshipType}</span>
                  </label>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-3"
              disabled={!subprocessorCandidates.some((c) => c.selected) || savingSubprocessors}
              onClick={handleSaveSubprocessors}
            >
              {savingSubprocessors ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Save Selected
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={onContinue}>
          Continue <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: AI Enrichment ────────────────────────────────────────────────────

interface Step4Props {
  vendorId: string;
  enrichmentData: EnrichmentData;
  onEnrichmentChange: (data: EnrichmentData) => void;
  onComplete: () => void;
  onBack: () => void;
  isCompleting: boolean;
}

function Step4Enrichment({
  vendorId,
  enrichmentData,
  onEnrichmentChange,
  onComplete,
  onBack,
  isCompleting,
}: Step4Props) {
  const [phase, setPhase] = useState<"enqueuing" | "polling" | "complete" | "error">("enqueuing");
  const [jobId, setJobId] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const triggerEnrich = async () => {
      try {
        const res = await fetch(`/api/v1/vendors/onboard/${vendorId}/enrich`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          if (!cancelled) setPhase("error");
          return;
        }

        const data = await res.json();
        const id = data?.jobId;
        if (!id) {
          if (!cancelled) setPhase("error");
          return;
        }

        if (!cancelled) {
          setJobId(id);
          setPhase("polling");
        }
      } catch {
        if (!cancelled) setPhase("error");
      }
    };

    triggerEnrich();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // Poll job status
  useEffect(() => {
    if (phase !== "polling" || !jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        });
        if (!res.ok) return;
        const job = await res.json();

        if (job.status === "completed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          // Extract enrichment fields from job result
          const result = job.result || {};
          onEnrichmentChange({
            industry: result.industry || "",
            riskIndicators: Array.isArray(result.riskIndicators)
              ? result.riskIndicators.join(", ")
              : result.riskIndicators || "",
            breachHistory: result.breachHistory || "",
            descriptionEnrichment: result.description || result.descriptionEnrichment || "",
          });
          setPhase("complete");
        } else if (job.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPhase("error");
        }
      } catch { /* keep polling */ }
    };

    pollIntervalRef.current = setInterval(poll, 2000);
    // Run immediately
    poll();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, jobId]);

  return (
    <div className="space-y-6 max-w-2xl">
      {(phase === "enqueuing" || phase === "polling") && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Analyzing vendor profile...</p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            Enrichment failed. You can skip this step and complete onboarding.{" "}
            <button
              type="button"
              className="underline font-medium ml-1"
              onClick={onComplete}
            >
              Skip
            </button>
          </AlertDescription>
        </Alert>
      )}

      {phase === "complete" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="enrich-industry">Industry Classification</Label>
            <Input
              id="enrich-industry"
              value={enrichmentData.industry || ""}
              onChange={(e) =>
                onEnrichmentChange({ ...enrichmentData, industry: e.target.value })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enrich-risk">Known Risk Indicators</Label>
            <Textarea
              id="enrich-risk"
              rows={2}
              value={enrichmentData.riskIndicators || ""}
              onChange={(e) =>
                onEnrichmentChange({ ...enrichmentData, riskIndicators: e.target.value })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enrich-breach">Public Breach History</Label>
            <Textarea
              id="enrich-breach"
              rows={2}
              value={enrichmentData.breachHistory || ""}
              onChange={(e) =>
                onEnrichmentChange({ ...enrichmentData, breachHistory: e.target.value })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enrich-desc">Company Description Enrichment</Label>
            <Textarea
              id="enrich-desc"
              rows={3}
              value={enrichmentData.descriptionEnrichment || ""}
              onChange={(e) =>
                onEnrichmentChange({
                  ...enrichmentData,
                  descriptionEnrichment: e.target.value,
                })
              }
            />
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {(phase === "complete" || phase === "error") && (
          <Button onClick={onComplete} disabled={isCompleting}>
            {isCompleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Complete Onboarding
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Progress Sidebar ─────────────────────────────────────────────────────────

interface SidebarProps {
  currentStep: number;
  vendorName: string;
  onCancelClick: () => void;
}

function ProgressSidebar({ currentStep, vendorName, onCancelClick }: SidebarProps) {
  return (
    <div className="w-60 shrink-0 hidden md:flex flex-col py-12 px-6 border-r bg-muted/20 min-h-screen">
      {vendorName && (
        <p className="text-sm font-semibold truncate mb-6 text-foreground">{vendorName}</p>
      )}

      <nav className="space-y-1 flex-1">
        {STEP_LABELS.map((label, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          return (
            <div key={idx} className="flex items-center gap-3 py-2">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
                aria-label={
                  isCompleted
                    ? `Step ${stepNum}: ${label} — completed`
                    : isActive
                    ? `Step ${stepNum}: ${label} — current`
                    : `Step ${stepNum}: ${label}`
                }
                aria-current={isActive ? "step" : undefined}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={cn(
                  "text-sm",
                  isActive ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onCancelClick}
        className="text-sm text-destructive mt-8 text-left hover:underline"
      >
        Cancel Onboarding
      </button>
    </div>
  );
}

// ─── Mobile stepper ───────────────────────────────────────────────────────────

function MobileStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2 md:hidden overflow-x-auto pb-2 pt-4 px-4">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        return (
          <div key={idx} className="flex items-center shrink-0">
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold",
                isCompleted || isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
              title={label}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "h-px w-6 mx-1",
                  stepNum < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main VendorOnboard component ─────────────────────────────────────────────

export default function VendorOnboard() {
  const [, params] = useRoute("/vendors/onboard/:id");
  const [, navigate] = useLocation();

  const routeId = params?.id ?? "new";

  const [currentStep, setCurrentStep] = useState(1);
  const [vendorId, setVendorId] = useState<string | null>(routeId === "new" ? null : routeId);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingLeaveTarget, setPendingLeaveTarget] = useState<string | null>(null);

  // Step 1 form data
  const [step1Data, setStep1Data] = useState<Step1Data>({
    name: "",
    description: "",
    category: "",
    contactEmail: "",
    contactName: "",
    tier: "medium",
  });

  // Step 2
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Step 3
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [subprocessorCandidates, setSubprocessorCandidates] = useState<SubprocessorCandidate[]>([]);

  // Step 4
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData>({});

  // Loading / submitting states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingVendor, setIsLoadingVendor] = useState(routeId !== "new");

  // ─── Resume: load existing vendor ─────────────────────────────────────────

  useEffect(() => {
    if (routeId === "new") return;

    const load = async () => {
      setIsLoadingVendor(true);
      try {
        const res = await fetch(`/api/v1/vendors/onboard/${routeId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        });
        if (!res.ok) {
          navigate("/vendors");
          return;
        }
        const vendor = await res.json();
        if (vendor.status && vendor.status !== "identification") {
          navigate(`/vendors/${routeId}`);
          return;
        }
        // Pre-fill step 1 data
        setStep1Data({
          name: vendor.name || "",
          description: vendor.description || "",
          category: vendor.category || "",
          contactEmail: vendor.contactEmail || "",
          contactName: vendor.contactName || "",
          tier: (vendor.tier as Tier) || "medium",
        });
        setCurrentStep(vendor.wizardStep || 1);
      } catch {
        navigate("/vendors");
      } finally {
        setIsLoadingVendor(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // ─── beforeunload guard ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ─── Step handlers ─────────────────────────────────────────────────────────

  const handleStep1Continue = async () => {
    setIsSubmitting(true);
    try {
      if (!vendorId) {
        // Create vendor
        const res = await fetch("/api/v1/vendors/onboard", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: step1Data.name,
            description: step1Data.description || undefined,
            category: step1Data.category || undefined,
            contactEmail: step1Data.contactEmail || undefined,
            contactName: step1Data.contactName || undefined,
            tier: step1Data.tier,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ variant: "destructive", title: err.message || "Something went wrong. Please try again." });
          return;
        }
        const vendor = await res.json();
        setVendorId(vendor.id);
        navigate(`/vendors/onboard/${vendor.id}`, { replace: true });
        setCurrentStep(2);
        setIsDirty(false);
      } else {
        // PATCH step 1
        const res = await fetch(`/api/v1/vendors/onboard/${vendorId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            step: 1,
            data: {
              name: step1Data.name,
              description: step1Data.description || undefined,
              category: step1Data.category || undefined,
              contactEmail: step1Data.contactEmail || undefined,
              contactName: step1Data.contactName || undefined,
              tier: step1Data.tier,
            },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ variant: "destructive", title: err.message || "Something went wrong. Please try again." });
          return;
        }
        setCurrentStep(2);
        setIsDirty(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep2Continue = async () => {
    if (!vendorId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/vendors/onboard/${vendorId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step: 2,
          data: { assessmentTemplateId: selectedTemplateId },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: err.message || "Something went wrong. Please try again." });
        return;
      }
      setCurrentStep(3);
      setIsDirty(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep3Continue = () => {
    setCurrentStep(4);
    setIsDirty(false);
  };

  const handleCompleteOnboarding = async () => {
    if (!vendorId) return;
    setIsCompleting(true);
    try {
      const res = await fetch(`/api/v1/vendors/onboard/${vendorId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step: 4,
          data: enrichmentData,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: err.message || "Something went wrong. Please try again." });
        return;
      }
      navigate(`/vendors/${vendorId}`);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!vendorId) {
      navigate("/vendors");
      return;
    }
    setIsDeleting(true);
    try {
      await fetch(`/api/v1/vendors/onboard/${vendorId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      navigate("/vendors");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveConfirm = () => {
    setShowLeaveDialog(false);
    if (pendingLeaveTarget) navigate(pendingLeaveTarget);
  };

  // ─── Render loading state ──────────────────────────────────────────────────

  if (isLoadingVendor) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const progressValue = (currentStep / 4) * 100;

  return (
    <AppLayout>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <ProgressSidebar
          currentStep={currentStep}
          vendorName={step1Data.name}
          onCancelClick={() => setShowCancelDialog(true)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Mobile stepper */}
          <MobileStepper currentStep={currentStep} />

          <div className="flex-1 px-8 pt-12 pb-12 max-w-3xl">
            {/* Progress bar + step counter */}
            <div className="mb-6 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  Step {currentStep} of 4
                </span>
              </div>
              <Progress value={progressValue} className="h-1" />
            </div>

            {/* Step title + icon */}
            <div className="flex items-center gap-3 mb-8">
              {currentStep === 4 && <Sparkles className="h-5 w-5 text-primary" />}
              {currentStep === 3 && <Upload className="h-5 w-5 text-muted-foreground" />}
              {currentStep === 2 && <Plus className="h-5 w-5 text-muted-foreground" />}
              <h1 className="text-xl font-semibold">
                {STEP_LABELS[currentStep - 1]}
              </h1>
            </div>

            <Separator className="mb-8" />

            {/* Step content */}
            {currentStep === 1 && (
              <Step1Form
                data={step1Data}
                onChange={(d) => { setStep1Data(d); setIsDirty(true); }}
                onContinue={handleStep1Continue}
                isLoading={isSubmitting}
              />
            )}

            {currentStep === 2 && vendorId && (
              <Step2Form
                vendorId={vendorId}
                selectedTemplateId={selectedTemplateId}
                onSelect={(id) => { setSelectedTemplateId(id); setIsDirty(true); }}
                onContinue={handleStep2Continue}
                onBack={() => setCurrentStep(1)}
                isLoading={isSubmitting}
              />
            )}

            {currentStep === 3 && vendorId && (
              <Step3Form
                vendorId={vendorId}
                uploadedFiles={uploadedFiles}
                onFilesChange={(f) => { setUploadedFiles(f); setIsDirty(true); }}
                subprocessorCandidates={subprocessorCandidates}
                onCandidatesChange={setSubprocessorCandidates}
                onContinue={handleStep3Continue}
                onBack={() => setCurrentStep(2)}
              />
            )}

            {currentStep === 4 && vendorId && (
              <Step4Enrichment
                vendorId={vendorId}
                enrichmentData={enrichmentData}
                onEnrichmentChange={(d) => { setEnrichmentData(d); setIsDirty(true); }}
                onComplete={handleCompleteOnboarding}
                onBack={() => setCurrentStep(3)}
                isCompleting={isCompleting}
              />
            )}

            {/* Mobile cancel link */}
            <div className="md:hidden mt-8">
              <button
                type="button"
                onClick={() => setShowCancelDialog(true)}
                className="text-sm text-destructive hover:underline"
              >
                Cancel Onboarding
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel onboarding dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the incomplete vendor record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete Vendor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave wizard dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress on this step has not been saved. Go back and click Continue to save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveConfirm}>Leave Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
