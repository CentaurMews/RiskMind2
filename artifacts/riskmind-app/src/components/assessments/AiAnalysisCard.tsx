import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiProvenance } from "@/components/ai/ai-provenance";

interface AiAnalysisCardProps {
  summary: string | null;
  isLoading: boolean;
  model?: string;
  generatedAt?: string;
}

export function AiAnalysisCard({ summary, isLoading, model, generatedAt }: AiAnalysisCardProps) {
  // Split summary into paragraphs on newlines
  const paragraphs = summary
    ? summary
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    : [];

  return (
    <Card className="bg-muted border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary/70" />
            <Badge variant="secondary">AI Analysis</Badge>
          </div>
          {model && generatedAt && (
            <AiProvenance action="Analyzed by" model={model} date={generatedAt} />
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : paragraphs.length > 0 ? (
          <div className="space-y-3">
            {paragraphs.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            AI analysis will appear here once generated.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
