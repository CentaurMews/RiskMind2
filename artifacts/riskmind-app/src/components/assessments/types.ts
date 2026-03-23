/**
 * Re-export assessment engine types for frontend component usage.
 * These mirror the types defined in artifacts/api-server/src/lib/assessment-engine.ts
 */

export interface BranchCondition {
  questionId: string;
  operator: "equals" | "contains" | "greater_than";
  value: string | number;
  action: "show" | "hide";
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  numericValue?: number;
}

export interface AssessmentQuestion {
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

export interface AssessmentSection {
  id: string;
  name: string;
  order: number;
  questions: AssessmentQuestion[];
}

export interface AssessmentTemplateQuestions {
  sections: AssessmentSection[];
  version: number;
}

export interface QuestionResponse {
  questionId: string;
  answer: string | boolean | number | string[];
  answeredAt: string;
}

export interface AiFollowUpRecord {
  id: string;
  triggeredByQuestionId: string;
  sectionId: string;
  question: AssessmentQuestion;
  generatedAt: string;
}

export interface AssessmentResponses {
  currentSectionIndex: number;
  responses: Record<string, QuestionResponse>;
  aiFollowUps: AiFollowUpRecord[];
  completedSections: string[];
}

export interface QuestionScore {
  questionId: string;
  score: number;
  weight: number;
}

export interface SectionScore {
  sectionId: string;
  name: string;
  score: number;
  questionScores: QuestionScore[];
}

export interface AssessmentScore {
  overall: number;
  sections: SectionScore[];
}

/**
 * Client-side branching visibility check.
 * Mirrors isQuestionVisible() from assessment-engine.ts.
 */
export function isQuestionVisible(
  question: AssessmentQuestion,
  allResponses: Record<string, QuestionResponse>,
  _allSectionQuestions: AssessmentQuestion[]
): boolean {
  if (question.conditions.length === 0) return true;

  const showConditions = question.conditions.filter((c) => c.action === "show");
  const hideConditions = question.conditions.filter((c) => c.action === "hide");

  const evaluate = (condition: BranchCondition): boolean => {
    const response = allResponses[condition.questionId];
    if (!response) return false;
    const answer = response.answer;

    switch (condition.operator) {
      case "equals":
        return String(answer) === String(condition.value);
      case "contains":
        return String(answer).includes(String(condition.value));
      case "greater_than":
        return Number(answer) > Number(condition.value);
      default:
        return false;
    }
  };

  if (hideConditions.length > 0 && hideConditions.some(evaluate)) return false;
  if (showConditions.length > 0) return showConditions.every(evaluate);
  return true;
}

/**
 * Derives score tier label and color from a 0–100 score value.
 */
export function getScoreTier(score: number): {
  label: string;
  color: string;
  className: string;
} {
  if (score >= 80) {
    return {
      label: "Low Risk",
      color: "var(--severity-low)",
      className: "text-green-500",
    };
  }
  if (score >= 60) {
    return {
      label: "Medium Risk",
      color: "var(--severity-medium)",
      className: "text-yellow-500",
    };
  }
  if (score >= 40) {
    return {
      label: "High Risk",
      color: "var(--severity-high)",
      className: "text-orange-500",
    };
  }
  return {
    label: "Critical Risk",
    color: "var(--severity-critical)",
    className: "text-red-500",
  };
}
