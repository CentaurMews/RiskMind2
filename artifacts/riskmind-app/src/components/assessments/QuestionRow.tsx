import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ConditionBuilder } from "./ConditionBuilder";
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssessmentQuestion, QuestionOption } from "./types";

interface QuestionRowProps {
  question: AssessmentQuestion;
  index: number;
  availableQuestions: AssessmentQuestion[];
  onUpdate: (q: AssessmentQuestion) => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
}

const QUESTION_TYPE_LABELS: Record<AssessmentQuestion["type"], string> = {
  text: "Text",
  boolean: "Boolean",
  multiple_choice: "Multiple Choice",
  numeric: "Numeric",
};

export function QuestionRow({
  question,
  index,
  availableQuestions,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false,
  isDropTarget = false,
}: QuestionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateQuestion = (patch: Partial<AssessmentQuestion>) => {
    onUpdate({ ...question, ...patch });
  };

  const addOption = () => {
    const options = question.options ?? [];
    const newOption: QuestionOption = {
      id: crypto.randomUUID(),
      label: "",
      value: "",
      numericValue: 0,
    };
    updateQuestion({ options: [...options, newOption] });
  };

  const updateOption = (optIndex: number, patch: Partial<QuestionOption>) => {
    const options = (question.options ?? []).map((o, i) =>
      i === optIndex ? { ...o, ...patch } : o
    );
    updateQuestion({ options });
  };

  const removeOption = (optIndex: number) => {
    updateQuestion({
      options: (question.options ?? []).filter((_, i) => i !== optIndex),
    });
  };

  return (
    <div
      className={cn(
        "transition-opacity",
        isDragging && "opacity-50",
        isDropTarget && "border-t-2 border-primary"
      )}
    >
      <Card
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="shadow-none border hover:border-border/80"
      >
        <CardContent className="p-0">
          {/* Collapsed row */}
          <div className="flex items-center gap-2 px-3 py-2 min-h-[44px]">
            {/* Drag handle */}
            <div
              className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 flex items-center h-[44px]"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Question number + text */}
            <span className="text-xs text-muted-foreground shrink-0 font-mono w-5">
              {index + 1}.
            </span>
            <p
              className={cn(
                "flex-1 text-sm truncate",
                !question.text && "text-muted-foreground italic"
              )}
            >
              {question.text || "Untitled question"}
            </p>

            {/* Type badge + weight */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">
                {QUESTION_TYPE_LABELS[question.type]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                w: {question.weight}
              </span>
            </div>

            {/* Expand / collapse */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {/* Remove */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Expanded edit form */}
          {isExpanded && (
            <>
              <Separator />
              <div className="p-4 space-y-4">
                {/* Question text */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Question</Label>
                  <Input
                    value={question.text}
                    onChange={(e) => updateQuestion({ text: e.target.value })}
                    placeholder="Enter question text..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={question.type}
                      onValueChange={(v) =>
                        updateQuestion({ type: v as AssessmentQuestion["type"] })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="multiple_choice">
                          Multiple Choice
                        </SelectItem>
                        <SelectItem value="numeric">Numeric</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Weight */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Weight (0–10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      value={question.weight}
                      onChange={(e) =>
                        updateQuestion({
                          weight: Math.min(10, Math.max(0, Number(e.target.value))),
                        })
                      }
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Required */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`required-${question.id}`}
                    checked={question.required}
                    onCheckedChange={(checked) =>
                      updateQuestion({ required: Boolean(checked) })
                    }
                  />
                  <Label htmlFor={`required-${question.id}`} className="text-xs cursor-pointer">
                    Required
                  </Label>
                </div>

                {/* Multiple choice options */}
                {question.type === "multiple_choice" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Options</Label>
                    {(question.options ?? []).map((option, optIndex) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Label"
                          className="h-8 text-xs"
                          value={option.label}
                          onChange={(e) =>
                            updateOption(optIndex, {
                              label: e.target.value,
                              value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Score (0-1)"
                          className="h-8 text-xs w-28"
                          min={0}
                          max={1}
                          step={0.1}
                          value={option.numericValue ?? 0}
                          onChange={(e) =>
                            updateOption(optIndex, {
                              numericValue: Math.min(1, Math.max(0, Number(e.target.value))),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeOption(optIndex)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={addOption}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Option
                    </Button>
                  </div>
                )}

                {/* Numeric min/max */}
                {question.type === "numeric" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Min</Label>
                      <Input
                        type="number"
                        className="h-9"
                        value={question.numericMin ?? ""}
                        onChange={(e) =>
                          updateQuestion({
                            numericMin:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max</Label>
                      <Input
                        type="number"
                        className="h-9"
                        value={question.numericMax ?? ""}
                        onChange={(e) =>
                          updateQuestion({
                            numericMax:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}

                {/* Branching conditions */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Branching Conditions</Label>
                  <p className="text-xs text-muted-foreground">
                    Show or hide this question based on prior answers.
                  </p>
                  <ConditionBuilder
                    conditions={question.conditions}
                    availableQuestions={availableQuestions}
                    onChange={(conditions) => updateQuestion({ conditions })}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
