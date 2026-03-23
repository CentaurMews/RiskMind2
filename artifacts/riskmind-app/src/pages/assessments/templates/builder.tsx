import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { SectionBlock } from "@/components/assessments/SectionBlock";
import { Plus, Eye, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AssessmentSection,
  AssessmentTemplateQuestions,
  AssessmentQuestion,
} from "@/components/assessments/types";

// ─── Preview pane ─────────────────────────────────────────────────────────────

interface TemplateState {
  title: string;
  description: string;
  contextType: string;
  sections: AssessmentSection[];
  version: number;
}

function PreviewQuestion({ question }: { question: AssessmentQuestion }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <p className="text-sm flex-1">
          {question.text || (
            <span className="text-muted-foreground italic">Untitled question</span>
          )}
          {question.required && (
            <span className="text-destructive ml-1">*</span>
          )}
        </p>
        <span className="text-xs text-muted-foreground shrink-0">
          w: {question.weight}
        </span>
      </div>

      {question.type === "boolean" && (
        <RadioGroup disabled className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="yes" id={`yes-${question.id}`} />
            <Label htmlFor={`yes-${question.id}`} className="text-xs">Yes</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="no" id={`no-${question.id}`} />
            <Label htmlFor={`no-${question.id}`} className="text-xs">No</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="na" id={`na-${question.id}`} />
            <Label htmlFor={`na-${question.id}`} className="text-xs">N/A</Label>
          </div>
        </RadioGroup>
      )}

      {question.type === "multiple_choice" &&
        question.options &&
        question.options.length > 0 && (
          <RadioGroup disabled className="space-y-1">
            {question.options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-1.5">
                <RadioGroupItem value={opt.value} id={`opt-${opt.id}`} />
                <Label htmlFor={`opt-${opt.id}`} className="text-xs">
                  {opt.label || opt.value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

      {question.type === "text" && (
        <Textarea
          disabled
          placeholder="Enter your response..."
          className="text-xs min-h-[60px] resize-none"
        />
      )}

      {question.type === "numeric" && (
        <div className="space-y-1">
          <Slider
            disabled
            min={question.numericMin ?? 0}
            max={question.numericMax ?? 100}
            value={[question.numericMin ?? 0]}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{question.numericMin ?? 0}</span>
            <span>{question.numericMax ?? 100}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ state }: { state: TemplateState }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
          PREVIEW
        </p>
        <h2 className="text-lg font-semibold">
          {state.title || (
            <span className="text-muted-foreground">Template name</span>
          )}
        </h2>
        {state.description && (
          <p className="text-sm text-muted-foreground mt-1">{state.description}</p>
        )}
        {state.contextType && (
          <Badge variant="secondary" className="mt-2 capitalize">
            {state.contextType === "framework" ? "Compliance" : state.contextType}
          </Badge>
        )}
      </div>

      {state.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No sections added yet.
        </p>
      ) : (
        state.sections.map((section) => (
          <div key={section.id} className="space-y-4">
            <h3 className="text-base font-semibold">
              {section.name || (
                <span className="text-muted-foreground italic">Untitled section</span>
              )}
            </h3>
            <Separator />
            {section.questions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No questions in this section.
              </p>
            ) : (
              <div className="space-y-4">
                {section.questions.map((question) => (
                  <PreviewQuestion key={question.id} question={question} />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Builder page ─────────────────────────────────────────────────────────────

export default function TemplateBuilder() {
  const params = useParams<{ id?: string }>();
  const templateId = params?.id;
  const isEditMode = Boolean(templateId);

  const [, setLocation] = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(isEditMode);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [state, setState] = useState<TemplateState>({
    title: "",
    description: "",
    contextType: "vendor",
    sections: [],
    version: 1,
  });

  // Load existing template in edit mode
  useEffect(() => {
    if (!isEditMode || !templateId) return;

    const loadTemplate = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`/v1/assessment-templates/${templateId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load template");
        const template = await res.json();
        const questions: AssessmentTemplateQuestions = template.questions ?? {
          sections: [],
          version: 1,
        };
        setState({
          title: template.title ?? "",
          description:
            template.description?.replace(/^\[PREBUILT\]\s*/, "") ?? "",
          contextType: template.contextType ?? "vendor",
          sections: questions.sections ?? [],
          version: (questions.version ?? 1) + 1,
        });
      } catch {
        toast({
          variant: "destructive",
          title: "Failed to load template",
          description: "Check your connection and try again.",
        });
      } finally {
        setIsLoadingTemplate(false);
      }
    };

    loadTemplate();
  }, [isEditMode, templateId]);

  const addSection = () => {
    const newSection: AssessmentSection = {
      id: crypto.randomUUID(),
      name: "",
      order: state.sections.length,
      questions: [],
    };
    setState((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  const updateSection = (index: number, section: AssessmentSection) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? section : s)),
    }));
  };

  const removeSection = (index: number) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!state.title.trim()) {
      toast({
        variant: "destructive",
        title: "Template name required",
        description: "Please enter a name for this template.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("accessToken");
      const body = {
        title: state.title,
        description: state.description || undefined,
        contextType: state.contextType,
        questions: {
          sections: state.sections,
          version: state.version,
        } as AssessmentTemplateQuestions,
      };

      const url = isEditMode
        ? `/v1/assessment-templates/${templateId}`
        : "/v1/assessment-templates";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save template");

      toast({ title: "Template saved" });
      setLocation("/assessments/templates");
    } catch {
      toast({
        variant: "destructive",
        title: "Template couldn't be saved. Check required fields and try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingTemplate) {
    return (
      <AppLayout>
        <div className="p-8 max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Sticky top bar */}
        <div className="border-b bg-background px-8 py-3 flex items-center justify-between shrink-0">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/assessments/templates">
                  Assessments
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/assessments/templates">
                  Templates
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {state.title ||
                    (isEditMode ? "Edit Template" : "New Template")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2">
            {/* Mobile preview button */}
            <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden">
                  <Eye className="h-4 w-4 mr-1.5" />
                  Preview
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full sm:max-w-md overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    PREVIEW
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <PreviewPanel state={state} />
                </div>
              </SheetContent>
            </Sheet>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Template
            </Button>
          </div>
        </div>

        {/* Two-panel body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel — builder canvas (60%) */}
          <div className="w-full lg:w-3/5 overflow-y-auto p-8 space-y-6">
            {/* Template metadata */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Template Name</Label>
                <Input
                  value={state.title}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Template name"
                  className="text-2xl font-semibold border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-1 placeholder:font-normal placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={state.description}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe this template..."
                  className="resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Context Type</Label>
                <Select
                  value={state.contextType}
                  onValueChange={(v) =>
                    setState((prev) => ({ ...prev, contextType: v }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="framework">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Sections</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSection}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Section
                </Button>
              </div>

              {state.sections.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    No sections added
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add a section to start building your questionnaire.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {state.sections.map((section, index) => (
                    <SectionBlock
                      key={section.id}
                      section={section}
                      allSections={state.sections}
                      onUpdate={(s) => updateSection(index, s)}
                      onRemove={() => removeSection(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bottom save action */}
            <div className="pt-4 pb-8">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className={cn("w-full sm:w-auto")}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Template
              </Button>
            </div>
          </div>

          {/* Right panel — preview pane (40%), hidden on mobile */}
          <div className="hidden lg:flex lg:w-2/5 border-l bg-muted/20 overflow-y-auto">
            <div className="p-8 w-full">
              <PreviewPanel state={state} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
