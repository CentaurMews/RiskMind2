import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ScoreGauge } from "@/components/assessments/ScoreGauge";
import { SectionScoreBar } from "@/components/assessments/SectionScoreBar";
import { AiAnalysisCard } from "@/components/assessments/AiAnalysisCard";
import { getScoreTier, type AssessmentScore, type SectionScore } from "@/components/assessments/types";

// ─── API helpers ──────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("accessToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ─── Types from results endpoint ─────────────────────────────────────────────

interface QuestionDetail {
  id: string;
  text: string;
  type: string;
  weight: number;
}

interface ResultsFromApi {
  assessment: {
    id: string;
    status: string;
    completedAt?: string | null;
    aiSummary?: string | null;
    aiModel?: string | null;
    responses?: {
      responses?: Record<string, { questionId: string; answer: string | boolean | number | string[] }>;
    } | null;
    subjectName?: string | null;
    template?: {
      title?: string;
      questions?: {
        sections?: Array<{
          id: string;
          name: string;
          order: number;
          questions: QuestionDetail[];
        }>;
      } | null;
    } | null;
  };
  score: AssessmentScore;
  template?: {
    title?: string;
    questions?: {
      sections?: Array<{
        id: string;
        name: string;
        order: number;
        questions: QuestionDetail[];
      }>;
    } | null;
  } | null;
}

// ─── Per-question detail row ──────────────────────────────────────────────────

function QuestionDetailRow({
  question,
  answer,
  questionScore,
}: {
  question: QuestionDetail;
  answer?: string | boolean | number | string[];
  questionScore?: { score: number; weight: number };
}) {
  const formatAnswer = (a: string | boolean | number | string[] | undefined): string => {
    if (a === undefined || a === null) return "—";
    if (Array.isArray(a)) return a.join(", ");
    if (typeof a === "boolean") return a ? "Yes" : "No";
    return String(a);
  };

  return (
    <div className="flex flex-col gap-1 py-3 border-b last:border-0">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm flex-1">{question.text}</p>
        {question.type !== "text" && questionScore && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">w:{question.weight}</span>
            <span className={`text-sm font-medium ${getScoreTier(questionScore.score * 100).className}`}>
              {(questionScore.score * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Answer: <span className="text-foreground">{formatAnswer(answer)}</span>
      </p>
    </div>
  );
}

// ─── Section collapsible ──────────────────────────────────────────────────────

function SectionDetail({
  section,
  sectionScore,
  responses,
  questions,
}: {
  section: { id: string; name: string };
  sectionScore?: SectionScore;
  responses: Record<string, { answer: string | boolean | number | string[] }>;
  questions: QuestionDetail[];
}) {
  const [open, setOpen] = useState(false);
  const tier = sectionScore ? getScoreTier(sectionScore.score) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors text-left">
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{section.name}</span>
        </div>
        {tier && sectionScore && (
          <Badge
            variant="outline"
            className={`text-xs ${tier.className}`}
          >
            {sectionScore.score.toFixed(0)}% — {tier.label}
          </Badge>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-11 pb-2">
          {questions.map((q) => {
            const resp = responses[q.id];
            const questionScore = sectionScore?.questionScores.find((qs) => qs.questionId === q.id);
            return (
              <QuestionDetailRow
                key={q.id}
                question={q}
                answer={resp?.answer}
                questionScore={questionScore}
              />
            );
          })}
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No questions in this section.</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssessmentResults() {
  const [, params] = useRoute("/assessments/:id/results");
  const { toast } = useToast();
  const assessmentId = params?.id ?? "";

  const [data, setData] = useState<ResultsFromApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadResults = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const result = await apiGet<ResultsFromApi>(`/api/v1/assessments/${assessmentId}/results`);
      setData(result);

      // Poll for AI summary if not yet available
      if (!result.assessment.aiSummary) {
        if (pollCountRef.current < 10) {
          setIsSummaryLoading(true);
          pollCountRef.current++;
          pollTimerRef.current = setTimeout(() => void loadResults(true), 5000);
        } else {
          setIsSummaryLoading(false);
        }
      } else {
        setIsSummaryLoading(false);
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      }
    } catch {
      if (!quiet) {
        toast({ title: "Failed to load results", variant: "destructive" });
      }
    } finally {
      if (!quiet) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!assessmentId) return;
    void loadResults();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [assessmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──
  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 max-w-[800px] mx-auto space-y-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Results not found.</div>
      </AppLayout>
    );
  }

  const { assessment, score } = data;
  const subjectName = assessment.subjectName ?? `Assessment ${assessmentId.slice(0, 8)}`;
  const templateSections =
    (assessment.template?.questions?.sections ?? data.template?.questions?.sections ?? []).sort(
      (a, b) => a.order - b.order
    );
  const completedAt = assessment.completedAt
    ? format(new Date(assessment.completedAt), "MMM d, yyyy")
    : null;
  const responseMap = assessment.responses?.responses ?? {};

  const summaryExpired = !assessment.aiSummary && !isSummaryLoading && pollCountRef.current >= 10;

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[800px] mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/assessments">Assessments</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/assessments/${assessmentId}/results`}>{subjectName}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Results</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold">{subjectName}</h1>
          {completedAt && (
            <p className="text-sm text-muted-foreground mt-1">Completed {completedAt}</p>
          )}
        </div>

        {/* 1. AI Analysis Card */}
        <div className="mb-8">
          <AiAnalysisCard
            summary={
              summaryExpired
                ? "Analysis is taking longer than expected. Please check back shortly."
                : (assessment.aiSummary ?? null)
            }
            isLoading={isSummaryLoading}
            model={assessment.aiModel ?? undefined}
            generatedAt={assessment.completedAt ?? undefined}
          />
        </div>

        {/* 2. Overall Score */}
        <div className="mb-8 text-center">
          <h2 className="text-xl font-semibold mb-6">Overall Score</h2>
          <div className="flex justify-center">
            <ScoreGauge score={score.overall} />
          </div>
        </div>

        {/* 3. Section Breakdown */}
        {score.sections.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Section Breakdown</h2>
            <SectionScoreBar sections={score.sections} />
          </div>
        )}

        {/* 4. Per-question detail */}
        {templateSections.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Question Detail</h2>
            <div className="border rounded-lg overflow-hidden">
              {templateSections.map((section) => {
                const sectionScore = score.sections.find((s) => s.sectionId === section.id);
                return (
                  <SectionDetail
                    key={section.id}
                    section={section}
                    sectionScore={sectionScore}
                    responses={responseMap}
                    questions={section.questions}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Action bar */}
        <div className="flex items-center gap-3 pt-6 border-t">
          <Button asChild>
            <Link href="/assessments/templates">Start New Assessment</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast({ title: "Coming soon", description: "PDF export will be available shortly." })
            }
          >
            Export PDF
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
