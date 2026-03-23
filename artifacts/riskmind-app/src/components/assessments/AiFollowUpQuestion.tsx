import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssessmentQuestion, QuestionResponse } from "./types";

interface AiFollowUpQuestionProps {
  question: AssessmentQuestion;
  response?: QuestionResponse;
  onAnswer: (response: QuestionResponse) => void;
  isLoading?: boolean;
}

export function AiFollowUpQuestion({
  question,
  response,
  onAnswer,
  isLoading = false,
}: AiFollowUpQuestionProps) {
  const handleAnswer = (answer: string | boolean | number) => {
    onAnswer({
      questionId: question.id,
      answer,
      answeredAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className="border-l-2 border-muted-foreground/30 pl-4 ml-4 mt-2 mb-4 opacity-0 animate-in fade-in duration-200 fill-mode-forwards"
      style={{ animationFillMode: "forwards" }}
    >
      <div className="mb-2">
        <Badge variant="secondary" className="text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          AI Generated
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground mb-3">{question.text}</p>

          {question.type === "boolean" && (
            <RadioGroup
              value={response ? String(response.answer) : undefined}
              onValueChange={(val) => handleAnswer(val === "true")}
              className="flex gap-4"
            >
              {["Yes", "No", "N/A"].map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={opt === "Yes" ? "true" : opt === "No" ? "false" : "n/a"}
                    id={`ai-${question.id}-${opt}`}
                  />
                  <Label htmlFor={`ai-${question.id}-${opt}`} className="text-sm cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === "multiple_choice" && (
            <RadioGroup
              value={response ? String(response.answer) : undefined}
              onValueChange={(val) => handleAnswer(val)}
              className="space-y-2"
            >
              {(question.options ?? []).map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`ai-${question.id}-${opt.id}`} />
                  <Label htmlFor={`ai-${question.id}-${opt.id}`} className="text-sm cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === "numeric" && (
            <div className="flex items-center gap-4">
              <Slider
                min={question.numericMin ?? 0}
                max={question.numericMax ?? 10}
                step={1}
                value={[response ? Number(response.answer) : (question.numericMin ?? 0)]}
                onValueChange={([val]) => handleAnswer(val)}
                className="flex-1"
              />
              <Input
                type="number"
                min={question.numericMin ?? 0}
                max={question.numericMax ?? 10}
                value={response ? String(response.answer) : ""}
                onChange={(e) => handleAnswer(Number(e.target.value))}
                className="w-20 text-sm"
              />
            </div>
          )}

          {question.type === "text" && (
            <Textarea
              placeholder="Your answer..."
              value={response ? String(response.answer) : ""}
              onBlur={(e) => {
                if (e.target.value) handleAnswer(e.target.value);
              }}
              onChange={(e) => {
                // Controlled: update on change, persist on blur
                if (response) {
                  onAnswer({
                    questionId: question.id,
                    answer: e.target.value,
                    answeredAt: new Date().toISOString(),
                  });
                }
              }}
              className="text-sm resize-none"
              rows={3}
            />
          )}
        </>
      )}
    </div>
  );
}
