import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuestionRow } from "./QuestionRow";
import { Plus, Trash2 } from "lucide-react";
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
import type { AssessmentSection, AssessmentQuestion } from "./types";

interface SectionBlockProps {
  section: AssessmentSection;
  allSections: AssessmentSection[];
  onUpdate: (s: AssessmentSection) => void;
  onRemove: () => void;
}

export function SectionBlock({
  section,
  onUpdate,
  onRemove,
}: SectionBlockProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const updateSection = (patch: Partial<AssessmentSection>) => {
    onUpdate({ ...section, ...patch });
  };

  const addQuestion = () => {
    const newQuestion: AssessmentQuestion = {
      id: crypto.randomUUID(),
      sectionId: section.id,
      text: "",
      type: "text",
      weight: 5,
      required: true,
      conditions: [],
    };
    updateSection({ questions: [...section.questions, newQuestion] });
  };

  const updateQuestion = (index: number, q: AssessmentQuestion) => {
    const questions = section.questions.map((existing, i) =>
      i === index ? q : existing
    );
    updateSection({ questions });
  };

  const removeQuestion = (index: number) => {
    updateSection({
      questions: section.questions.filter((_, i) => i !== index),
    });
  };

  // Drag-to-reorder handlers
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    setDragIndex(index);
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const reordered = [...section.questions];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    updateSection({ questions: reordered });
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const hasQuestions = section.questions.length > 0;

  return (
    <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Input
          value={section.name}
          onChange={(e) => updateSection({ name: e.target.value })}
          placeholder="Section name"
          className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 px-0 placeholder:font-normal placeholder:text-muted-foreground"
        />
        {hasQuestions ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove section?</AlertDialogTitle>
                <AlertDialogDescription>
                  This section and all {section.questions.length} question
                  {section.questions.length !== 1 ? "s" : ""} within it will be
                  permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onRemove}
                >
                  Remove Section
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator />

      {/* Questions */}
      {section.questions.length === 0 ? (
        <Alert variant="default" className="border-dashed">
          <AlertDescription className="text-xs text-muted-foreground">
            No questions added yet. Add a question to this section.
          </AlertDescription>
        </Alert>
      ) : (
        <div
          className="space-y-2"
          onDragEnd={handleDragEnd}
        >
          {section.questions.map((question, index) => {
            // Only prior questions in the same section are available for branching
            const priorQuestions = section.questions.slice(0, index);
            return (
              <QuestionRow
                key={question.id}
                question={question}
                index={index}
                availableQuestions={priorQuestions}
                onUpdate={(q) => updateQuestion(index, q)}
                onRemove={() => removeQuestion(index)}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                isDragging={dragIndex === index}
                isDropTarget={
                  dropIndex === index &&
                  dragIndex !== null &&
                  dragIndex !== index
                }
              />
            );
          })}
        </div>
      )}

      {/* Add question */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={addQuestion}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Question
      </Button>
    </div>
  );
}
