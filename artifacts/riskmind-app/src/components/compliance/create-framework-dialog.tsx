import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FrameworkType = "regulatory" | "industry" | "internal" | "other";

const FRAMEWORK_TYPES: { value: FrameworkType; label: string }[] = [
  { value: "regulatory", label: "Regulatory" },
  { value: "industry", label: "Industry" },
  { value: "internal", label: "Internal" },
  { value: "other", label: "Other" },
];

interface CreateFrameworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateFrameworkDialog({ open, onOpenChange, onSuccess }: CreateFrameworkDialogProps) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [type, setType] = useState<FrameworkType | "">("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState("");

  function resetState() {
    setName("");
    setVersion("");
    setType("");
    setDescription("");
    setIsLoading(false);
    setNameError("");
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetState();
    onOpenChange(open);
  }

  function validateName(value: string): string {
    if (!value.trim()) return "Name is required.";
    if (value.trim().length < 3) return "Name must be at least 3 characters.";
    if (value.trim().length > 100) return "Name must be at most 100 characters.";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateName(name);
    if (err) {
      setNameError(err);
      return;
    }
    setIsLoading(true);
    try {
      const body: Record<string, string> = { name: name.trim() };
      if (version.trim()) body.version = version.trim();
      if (type) body.type = type;
      if (description.trim()) body.description = description.trim();

      const res = await fetch("/api/v1/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Failed to create framework" }));
        throw new Error(errData.message || "Failed to create framework");
      }

      toast({ title: "Framework created successfully." });
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({ variant: "destructive", title: (err as Error).message || "Failed to create framework." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Framework</DialogTitle>
          <DialogDescription>
            Add a new compliance framework to the system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fw-name">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="fw-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(validateName(e.target.value));
              }}
              placeholder="e.g. ISO 27001, SOC 2, NIST CSF"
              className={cn(
                "w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring",
                nameError ? "border-destructive" : "border-input"
              )}
              maxLength={100}
              autoFocus
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          {/* Version */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fw-version">
              Version <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="fw-version"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 2022, v3.1"
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={50}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fw-type">
              Type <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              id="fw-type"
              value={type}
              onChange={(e) => setType(e.target.value as FrameworkType | "")}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select type...</option>
              {FRAMEWORK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fw-desc">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="fw-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this framework..."
              rows={3}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                "Create Framework"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
