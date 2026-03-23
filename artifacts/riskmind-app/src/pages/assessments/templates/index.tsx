import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
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
import { Plus, Trash2, ClipboardList } from "lucide-react";

interface BranchCondition {
  questionId: string;
  operator: "equals" | "contains" | "greater_than";
  value: string | number;
  action: "show" | "hide";
}

interface QuestionOption {
  id: string;
  label: string;
  value: string;
  numericValue?: number;
}

interface AssessmentQuestion {
  id: string;
  sectionId: string;
  text: string;
  type: "text" | "boolean" | "multiple_choice" | "numeric";
  weight: number;
  required: boolean;
  options?: QuestionOption[];
  numericMin?: number;
  numericMax?: number;
  conditions: BranchCondition[];
  isAiGenerated?: boolean;
  triggeredByQuestionId?: string;
}

interface AssessmentSection {
  id: string;
  name: string;
  order: number;
  questions: AssessmentQuestion[];
}

interface AssessmentTemplateQuestions {
  sections: AssessmentSection[];
  version: number;
}

interface AssessmentTemplate {
  id: string;
  title: string;
  description?: string | null;
  contextType: string;
  questions: AssessmentTemplateQuestions;
  createdAt: string;
  updatedAt: string;
}

const CONTEXT_TYPE_LABELS: Record<string, string> = {
  vendor: "Vendor",
  framework: "Compliance",
  control: "Incident",
};

type FilterType = "all" | "vendor" | "framework" | "control";

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vendor", label: "Vendor" },
  { id: "framework", label: "Compliance" },
  { id: "control", label: "Incident" },
];

function isPrebuilt(template: AssessmentTemplate): boolean {
  return template.description?.startsWith("[PREBUILT]") ?? false;
}

function displayDescription(template: AssessmentTemplate): string {
  if (template.description?.startsWith("[PREBUILT]")) {
    return template.description.replace(/^\[PREBUILT\]\s*/, "");
  }
  return template.description ?? "";
}

function countQuestions(template: AssessmentTemplate): number {
  return template.questions.sections.reduce(
    (acc, section) => acc + section.questions.length,
    0
  );
}

function countSections(template: AssessmentTemplate): number {
  return template.questions.sections.length;
}

export default function TemplateLibrary() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<FilterType>("all");
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const params = filter !== "all" ? `?contextType=${filter}` : "";
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/v1/assessment-templates${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to load templates",
        description: "Check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleClone = async (id: string) => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/v1/assessment-templates/${id}/clone`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to clone template");
      const cloned = await res.json();
      toast({ title: "Template cloned" });
      setLocation(`/assessments/templates/${cloned.id}/edit`);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to clone template",
        description: "Try again in a moment.",
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/v1/assessment-templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete template");
      toast({ title: "Template deleted" });
      await fetchTemplates();
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to delete template",
        description: "Try again in a moment.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Assessment Templates
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Browse and manage questionnaire templates for vendor and compliance
              assessments.
            </p>
          </div>
          <Link href="/assessments/templates/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No templates yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Create your first assessment template to start evaluating vendors
              and compliance controls.
            </p>
            <Link href="/assessments/templates/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => {
              const prebuilt = isPrebuilt(template);
              const description = displayDescription(template);
              const questionCount = countQuestions(template);
              const sectionCount = countSections(template);
              const contextLabel =
                CONTEXT_TYPE_LABELS[template.contextType] ?? template.contextType;

              return (
                <Card key={template.id} className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold leading-tight truncate">
                          {template.title}
                        </h3>
                      </div>
                      {!prebuilt && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === template.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete template?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This template will be permanently deleted.
                                Assessments already created from it are not
                                affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(template.id)}
                              >
                                Delete Template
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary">{contextLabel}</Badge>
                      {prebuilt && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                          title="Pre-built template — clone to customize"
                        >
                          Built-in
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col justify-between pt-0">
                    <div className="space-y-2 mb-4">
                      {description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {questionCount} question{questionCount !== 1 ? "s" : ""} ·{" "}
                        {sectionCount} section{sectionCount !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/assessments/new?templateId=${template.id}`} className="flex-1">
                        <Button variant="default" size="sm" className="w-full">
                          Use Template
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClone(template.id)}
                      >
                        Clone &amp; Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
