/**
 * Assessment Engine — pure TypeScript scoring and branching logic.
 *
 * This module is the single source of truth for:
 *  - JSONB schemas for questions (stored on assessment_templates) and
 *    responses (stored on assessments)
 *  - Deterministic weighted scoring
 *  - Branching visibility evaluation
 *
 * All functions are pure (no I/O, no side effects) and fully deterministic:
 * identical inputs always produce identical outputs.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BranchCondition {
  /** Which prior question to evaluate */
  questionId: string;
  operator: "equals" | "contains" | "greater_than";
  value: string | number;
  /** What to do with THIS question when the condition is met */
  action: "show" | "hide";
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  /** Normalized 0–1 score for this option; used by normalizeAnswer() */
  numericValue?: number;
}

export interface AssessmentQuestion {
  id: string;
  sectionId: string;
  text: string;
  type: "text" | "boolean" | "multiple_choice" | "numeric";
  /** 0–10; default 5 */
  weight: number;
  required: boolean;
  /** multiple_choice only */
  options?: QuestionOption[];
  /** numeric only */
  numericMin?: number;
  /** numeric only */
  numericMax?: number;
  /** show/hide rules for THIS question; evaluated against prior responses */
  conditions: BranchCondition[];
  /** true for LLM-generated follow-up questions */
  isAiGenerated?: boolean;
  /** which question triggered this AI follow-up */
  triggeredByQuestionId?: string;
}

export interface AssessmentSection {
  id: string;
  name: string;
  order: number;
  questions: AssessmentQuestion[];
}

/** Top-level shape of the `questions` JSONB column on assessment_templates */
export interface AssessmentTemplateQuestions {
  sections: AssessmentSection[];
  /** Incremented on each template save */
  version: number;
}

export interface QuestionResponse {
  questionId: string;
  answer: string | boolean | number | string[];
  /** ISO timestamp */
  answeredAt: string;
}

export interface AiFollowUpRecord {
  id: string;
  triggeredByQuestionId: string;
  sectionId: string;
  /** Full question object — persisted to survive page refresh (D-06) */
  question: AssessmentQuestion;
  generatedAt: string;
}

/** Top-level shape of the `responses` JSONB column on assessments */
export interface AssessmentResponses {
  currentSectionIndex: number;
  /** Keyed by questionId */
  responses: Record<string, QuestionResponse>;
  /** All AI-generated follow-up questions; replayed on page refresh */
  aiFollowUps: AiFollowUpRecord[];
  /** sectionIds that have been submitted */
  completedSections: string[];
}

export interface QuestionScore {
  questionId: string;
  /** Weighted score (normalizedAnswer × weight) */
  score: number;
  weight: number;
}

export interface SectionScore {
  sectionId: string;
  name: string;
  /** 0–100, rounded to 2 decimal places */
  score: number;
  questionScores: QuestionScore[];
}

export interface AssessmentScore {
  /** 0–100, rounded to 2 decimal places */
  overall: number;
  sections: SectionScore[];
}

// ─── Branching ────────────────────────────────────────────────────────────────

/**
 * Determines whether a question is visible given the current response set.
 *
 * Rules:
 * - No conditions → always visible
 * - action="show": ALL conditions must pass for the question to be visible.
 *   If the referenced question has no response, treat as "condition not met"
 *   (hidden until dependency is answered).
 * - action="hide": if ANY condition passes, the question is hidden.
 *   If the referenced question has no response, treat as "condition not met"
 *   (visible until dependency is answered).
 *
 * Operators are evaluated against string representations for "equals" and
 * "contains", and numeric representations for "greater_than".
 */
export function isQuestionVisible(
  question: AssessmentQuestion,
  allResponses: Record<string, QuestionResponse>,
  _allSectionQuestions: AssessmentQuestion[]
): boolean {
  if (question.conditions.length === 0) return true;

  // Separate show-conditions and hide-conditions
  const showConditions = question.conditions.filter(c => c.action === "show");
  const hideConditions = question.conditions.filter(c => c.action === "hide");

  // Evaluate a single condition against the current response set
  const evaluate = (condition: BranchCondition): boolean => {
    const response = allResponses[condition.questionId];
    if (!response) return false; // no response → condition not met
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

  // Hide wins immediately if any hide-condition is met
  if (hideConditions.length > 0) {
    if (hideConditions.some(evaluate)) return false;
  }

  // Show requires all show-conditions to pass
  if (showConditions.length > 0) {
    return showConditions.every(evaluate);
  }

  // Only hide-conditions existed, and none fired → visible
  return true;
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalizes a raw answer to the 0.0–1.0 range for scoring.
 *
 * - boolean:         true=1.0, false=0.0, null/undefined=0.0
 * - numeric:         (answer − min) / (max − min), clamped to [0, 1].
 *                    Defaults to min=0, max=10 if not configured.
 * - multiple_choice: option's numericValue. Falls back to position-based
 *                    if numericValue is absent.
 * - text:            always 1.0 (qualitative — no numeric penalty)
 * - null/undefined:  always 0.0
 */
export function normalizeAnswer(
  question: AssessmentQuestion,
  answer: string | boolean | number | string[] | null | undefined
): number {
  if (answer === null || answer === undefined) return 0.0;

  switch (question.type) {
    case "boolean": {
      return answer === true ? 1.0 : 0.0;
    }

    case "numeric": {
      const num = Number(answer);
      if (!Number.isFinite(num)) return 0.0;
      const min = question.numericMin ?? 0;
      const max = question.numericMax ?? 10;
      if (max === min) return 0.0; // avoid divide-by-zero
      const normalized = (num - min) / (max - min);
      return Math.min(1, Math.max(0, normalized));
    }

    case "multiple_choice": {
      const options = question.options ?? [];
      const selected = String(answer);
      const matchedOption = options.find(opt => opt.value === selected);
      if (!matchedOption) return 0.0;
      if (matchedOption.numericValue !== undefined) return matchedOption.numericValue;
      // Fallback: position-based (0-indexed, spread across 0–1)
      const index = options.indexOf(matchedOption);
      return options.length > 1 ? index / (options.length - 1) : 1.0;
    }

    case "text":
    default:
      return 1.0;
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Computes weighted scores for all sections and an overall score.
 *
 * Algorithm:
 * 1. For each section, filter to visible questions (isQuestionVisible).
 * 2. For each visible question: questionScore = normalizeAnswer × weight
 * 3. sectionScore = (Σ questionScore) / (Σ weight) × 100, rounded to 2dp.
 * 4. overall = average of non-empty section scores, rounded to 2dp.
 *
 * Empty sections (0 visible questions) are excluded from the overall average.
 * Hidden questions never contribute to the denominator — this prevents the
 * "branching-exclusion pitfall" documented in 10-RESEARCH.md.
 *
 * This function is pure and deterministic: identical inputs always produce
 * identical outputs.
 */
export function computeScore(
  template: AssessmentTemplateQuestions,
  responses: AssessmentResponses
): AssessmentScore {
  const sectionScores: SectionScore[] = template.sections.map(section => {
    const visibleQuestions = section.questions.filter(q =>
      isQuestionVisible(q, responses.responses, section.questions)
    );

    const questionScores: QuestionScore[] = visibleQuestions.map(q => {
      const response = responses.responses[q.id];
      const normalized = normalizeAnswer(q, response?.answer ?? null);
      return {
        questionId: q.id,
        score: normalized * q.weight,
        weight: q.weight,
      };
    });

    const totalWeight = questionScores.reduce((sum, qs) => sum + qs.weight, 0);
    const weightedSum = questionScores.reduce((sum, qs) => sum + qs.score, 0);
    const rawScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
    // Round to 2dp at section level to prevent floating-point accumulation
    const sectionScore = Math.round(rawScore * 100) / 100;

    return {
      sectionId: section.id,
      name: section.name,
      score: sectionScore,
      questionScores,
    };
  });

  // Exclude empty sections (0 visible questions)
  const nonEmptySections = sectionScores.filter((_, idx) => {
    const section = template.sections[idx];
    const visibleCount = section.questions.filter(q =>
      isQuestionVisible(q, responses.responses, section.questions)
    ).length;
    return visibleCount > 0;
  });

  const overall =
    nonEmptySections.length > 0
      ? nonEmptySections.reduce((sum, s) => sum + s.score, 0) / nonEmptySections.length
      : 0;

  return {
    overall: Math.round(overall * 100) / 100,
    sections: sectionScores,
  };
}
