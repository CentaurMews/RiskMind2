import { Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AiProvenanceProps {
  action: string;       // "Enriched by", "Suggested by", "Triaged by"
  model?: string;       // model name; falls back to "AI" if undefined/null
  date?: string | Date; // shown as "MMM d, yyyy" via date-fns format()
  confidence?: number;  // 0.0–1.0; shown as "X% confidence" if provided
  className?: string;
}

export function AiProvenance({ action, model, date, confidence, className }: AiProvenanceProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <Sparkles className="h-3 w-3 text-primary/60" />
      <span>
        {action}{" "}
        <span className="font-medium text-foreground/70">{model ?? "AI"}</span>
        {date && ` · ${format(new Date(date), "MMM d, yyyy")}`}
        {confidence != null && (
          <>
            {" · "}
            <span className="font-medium">{Math.round(confidence * 100)}% confidence</span>
          </>
        )}
      </span>
    </div>
  );
}
