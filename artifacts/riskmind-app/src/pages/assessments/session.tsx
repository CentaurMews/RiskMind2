import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { WizardStepper } from "@/components/assessments/WizardStepper";
import { AiFollowUpQuestion } from "@/components/assessments/AiFollowUpQuestion";
import {
  isQuestionVisible,
  type AssessmentSection,
  type AssessmentTemplateQuestions,
  type QuestionResponse,
  type AiFollowUpRecord,
} from "@/components/assessments/types";

// ─── API helpers ──────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ─── Assessment shape from API ────────────────────────────────────────────────

interface AssessmentFromApi {
  id: string;
  status: string;
  contextType?: string | null;
  contextId?: string | null;
  templateId?: string | null;
  score?: unknown;
  aiSummary?: string | null;
  responses?: {
    currentSectionIndex?: number;
    responses?: Record<string, QuestionResponse>;
    aiFollowUps?: AiFollowUpRecord[];
    completedSections?: string[];
  } | null;
  template?: {
    id: string;
    title: string;
    questions?: AssessmentTemplateQuestions | null;
  } | null;
  subjectName?: string | null;
}

// ─── Question input renderers ─────────────────────────────────────────────────

function QuestionInput({
  question,
  response,
  onAnswer,
}: {
  question: { id: string; type: string; options?: { id: string; label: string; value: string }[]; numericMin?: number; numericMax?: number };
  response?: QuestionResponse;
  onAnswer: (answer: string | boolean | number) => void;
}) {
  if (question.type === "boolean") {
    return (
      <RadioGroup
        value={
          response
            ? response.answer === true || response.answer === "true"
              ? "true"
              : response.answer === "n/a"
              ? "n/a"
              : "false"
            : undefined
        }
        onValueChange={(val) => {
          if (val === "true") onAnswer(true);
          else if (val === "false") onAnswer(false);
          else onAnswer("n/a");
        }}
        className="flex gap-6"
      >
        {["Yes", "No", "N/A"].map((opt) => {
          const val = opt === "Yes" ? "true" : opt === "No" ? "false" : "n/a";
          return (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem value={val} id={`${question.id}-${opt}`} />
              <Label htmlFor={`${question.id}-${opt}`} className="text-sm cursor-pointer">{opt}</Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <RadioGroup
        value={response ? String(response.answer) : undefined}
        onValueChange={(val) => onAnswer(val)}
        className="space-y-2"
      >
        {(question.options ?? []).map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <RadioGroupItem value={opt.value} id={`${question.id}-${opt.id}`} />
            <Label htmlFor={`${question.id}-${opt.id}`} className="text-sm cursor-pointer">{opt.label}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (question.type === "numeric") {
    const min = question.numericMin ?? 0;
    const max = question.numericMax ?? 10;
    const current = response ? Number(response.answer) : min;
    return (
      <div className="flex items-center gap-4">
        <Slider
          min={min}
          max={max}
          step={1}
          value={[current]}
          onValueChange={([val]) => onAnswer(val)}
          className="flex-1"
        />
        <Input
          type="number"
          min={min}
          max={max}
          value={response ? String(response.answer) : ""}
          onChange={(e) => onAnswer(Number(e.target.value))}
          className="w-20 text-sm"
        />
      </div>
    );
  }

  // text
  return (
    <Textarea
      placeholder="Your answer..."
      defaultValue={response ? String(response.answer) : ""}
      onBlur={(e) => {
        if (e.target.value) onAnswer(e.target.value);
      }}
      className="text-sm resize-none"
      rows={3}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssessmentSession() {
  const [, params] = useRoute("/assessments/:id/session");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const assessmentId = params?.id ?? "";

  const [assessment, setAssessment] = useState<AssessmentFromApi | null>(null);
  const [sections, setSections] = useState<AssessmentSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Session state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [aiFollowUps, setAiFollowUps] = useState<AiFollowUpRecord[]>([]);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [aiLoadingForQuestion, setAiLoadingForQuestion] = useState<string | null>(null);

  // Guard: track which questions have already triggered a follow-up this session
  const followUpTriggeredRef = useRef<Set<string>>(new Set());

  // ── Load assessment on mount ──
  useEffect(() => {
    if (!assessmentId) return;
    setIsLoading(true);
    apiGet<AssessmentFromApi>(`/v1/assessments/${assessmentId}`)
      .then((data) => {
        setAssessment(data);
        const templateSections = data.template?.questions?.sections ?? [];
        const sorted = [...templateSections].sort((a, b) => a.order - b.order);
        setSections(sorted);

        // D-06: restore session state from persisted responses
        if (data.responses) {
          const r = data.responses;
          setCurrentSectionIndex(r.currentSectionIndex ?? 0);
          setResponses(r.responses ?? {});
          setAiFollowUps(r.aiFollowUps ?? []);
          setCompletedSections(r.completedSections ?? []);

          // Pre-populate the follow-up guard set with already-triggered questions
          (r.aiFollowUps ?? []).forEach((fu) => {
            followUpTriggeredRef.current.add(fu.triggeredByQuestionId);
          });
        }
      })
      .catch(() => {
        toast({ title: "Failed to load assessment", variant: "destructive" });
      })
      .finally(() => setIsLoading(false));
  }, [assessmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save responses to DB ──
  const saveResponses = useCallback(
    async (nextIndex: number, nextCompleted: string[], nextResponses: Record<string, QuestionResponse>, nextFollowUps: AiFollowUpRecord[]) => {
      setIsSaving(true);
      try {
        await apiPatch(`/v1/assessments/${assessmentId}/responses`, {
          currentSectionIndex: nextIndex,
          responses: nextResponses,
          aiFollowUps: nextFollowUps,
          completedSections: nextCompleted,
        });
      } catch {
        toast({
          title: "Couldn't save your progress. Check your connection and try again.",
          variant: "destructive",
        });
        throw new Error("save_failed");
      } finally {
        setIsSaving(false);
      }
    },
    [assessmentId, toast]
  );

  // ── Handle answer change + trigger AI follow-up ──
  const handleAnswer = useCallback(
    async (questionId: string, answer: string | boolean | number) => {
      const newResponse: QuestionResponse = {
        questionId,
        answer,
        answeredAt: new Date().toISOString(),
      };

      const updatedResponses = { ...responses, [questionId]: newResponse };
      setResponses(updatedResponses);

      // Guard: only trigger once per question per session
      if (followUpTriggeredRef.current.has(questionId)) return;
      followUpTriggeredRef.current.add(questionId);

      // Build section responses for the current section
      const currentSection = sections[currentSectionIndex];
      if (!currentSection) return;

      const sectionResponseEntries = Object.entries(updatedResponses).filter(([qId]) =>
        currentSection.questions.some((q) => q.id === qId)
      );
      const sectionResponses = Object.fromEntries(sectionResponseEntries);

      // Trigger AI follow-up via SSE
      setAiLoadingForQuestion(questionId);
      try {
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`/v1/assessments/${assessmentId}/follow-up`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ questionId, sectionResponses }),
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let followUpQuestion = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") break;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.type === "follow_up" && parsed.question) {
                  followUpQuestion = parsed.question;
                }
                if (parsed.type === "done") {
                  break;
                }
              } catch {
                // ignore parse errors
              }
            }
            if (line.startsWith("event: done")) {
              break;
            }
          }
        }

        if (followUpQuestion) {
          const record: AiFollowUpRecord = {
            id: crypto.randomUUID(),
            triggeredByQuestionId: questionId,
            sectionId: currentSection.id,
            question: followUpQuestion,
            generatedAt: new Date().toISOString(),
          };
          setAiFollowUps((prev) => [...prev, record]);
        }
      } catch {
        // Silent failure per UI-SPEC: follow-up simply does not appear
      } finally {
        setAiLoadingForQuestion(null);
      }
    },
    [responses, sections, currentSectionIndex, assessmentId]
  );

  // ── Navigation ──
  const handleNext = async () => {
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return;

    const newCompleted = completedSections.includes(currentSection.id)
      ? completedSections
      : [...completedSections, currentSection.id];

    const nextIndex = currentSectionIndex + 1;
    const newCompleted2 = newCompleted;

    try {
      await saveResponses(nextIndex, newCompleted2, responses, aiFollowUps);
      setCompletedSections(newCompleted2);
      setCurrentSectionIndex(nextIndex);
      window.scrollTo(0, 0);
    } catch {
      // Toast already shown in saveResponses
    }
  };

  const handlePrevious = async () => {
    const prevIndex = currentSectionIndex - 1;
    try {
      await saveResponses(prevIndex, completedSections, responses, aiFollowUps);
      setCurrentSectionIndex(prevIndex);
      window.scrollTo(0, 0);
    } catch {
      // Toast already shown in saveResponses
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiPost(`/v1/assessments/${assessmentId}/submit`);
      setLocation(`/assessments/${assessmentId}/results`);
    } catch {
      toast({
        title: "Submission failed. Your responses are saved — try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAbandon = async () => {
    try {
      await apiPost(`/v1/assessments/${assessmentId}/abandon`);
      setLocation("/assessments");
    } catch {
      toast({ title: "Failed to abandon assessment", variant: "destructive" });
    }
  };

  // ── Render ──
  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!assessment) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Assessment not found.</div>
      </AppLayout>
    );
  }

  const currentSection = sections[currentSectionIndex];
  const totalSections = sections.length;
  const isLastSection = currentSectionIndex === totalSections - 1;
  const progressValue = totalSections > 0 ? (completedSections.length / totalSections) * 100 : 0;

  const subjectName = assessment.subjectName ?? `Assessment ${assessmentId.slice(0, 8)}`;
  const templateName = assessment.template?.title ?? "Assessment";

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
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
              <BreadcrumbPage>{subjectName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">{subjectName}</h1>
            <p className="text-sm text-muted-foreground">{templateName}</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                Abandon
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abandon this assessment?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your progress so far is saved. You can return and continue later from the Assessments list.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep going</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAbandon}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Abandon Assessment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Wizard Stepper */}
        <WizardStepper
          sections={sections.map((s) => ({ id: s.id, name: s.name }))}
          currentIndex={currentSectionIndex}
          completedSections={completedSections}
        />

        {/* Progress bar */}
        <div className="flex items-center gap-3 mt-4 mb-6">
          <Progress value={progressValue} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground shrink-0">
            Section {currentSectionIndex + 1} of {totalSections}
          </span>
        </div>

        {/* Current section */}
        {currentSection ? (
          <>
            <h2 className="text-xl font-semibold mb-6">{currentSection.name}</h2>

            <div className="space-y-8">
              {currentSection.questions.map((question) => {
                const visible = isQuestionVisible(question, responses, currentSection.questions);
                const questionResponse = responses[question.id];
                const followUp = aiFollowUps.find((fu) => fu.triggeredByQuestionId === question.id);
                const isFollowUpLoading = aiLoadingForQuestion === question.id;

                return (
                  <div
                    key={question.id}
                    className="overflow-hidden transition-all duration-150"
                    style={{
                      maxHeight: visible ? "2000px" : "0",
                      opacity: visible ? 1 : 0,
                    }}
                  >
                    {visible && (
                      <div className="space-y-3">
                        <p className="text-sm">
                          {question.text}{" "}
                          <span className="text-muted-foreground text-xs">(weight: {question.weight})</span>
                        </p>

                        <QuestionInput
                          question={question}
                          response={questionResponse}
                          onAnswer={(answer) => void handleAnswer(question.id, answer)}
                        />

                        {/* AI follow-up loading state */}
                        {isFollowUpLoading && (
                          <div className="border-l-2 border-muted-foreground/30 pl-4 ml-4 mt-2">
                            <Skeleton className="h-4 w-3/5" />
                          </div>
                        )}

                        {/* AI follow-up question */}
                        {!isFollowUpLoading && followUp && (
                          <AiFollowUpQuestion
                            question={followUp.question}
                            response={responses[followUp.question.id]}
                            onAnswer={(resp) => {
                              setResponses((prev) => ({
                                ...prev,
                                [resp.questionId]: resp,
                              }));
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t">
              <Button
                variant="ghost"
                onClick={() => void handlePrevious()}
                disabled={currentSectionIndex === 0 || isSaving}
              >
                Previous
              </Button>

              {isLastSection ? (
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || isSaving}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Assessment"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => void handleNext()}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Next Section"
                  )}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            No sections found in this assessment template.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
