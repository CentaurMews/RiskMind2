import { describe, it, expect } from "vitest";
import {
  computeScore,
  isQuestionVisible,
  normalizeAnswer,
  type AssessmentQuestion,
  type AssessmentSection,
  type AssessmentTemplateQuestions,
  type AssessmentResponses,
  type QuestionResponse,
} from "../src/lib/assessment-engine";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeTextQuestion(id: string, sectionId: string, weight = 5): AssessmentQuestion {
  return {
    id,
    sectionId,
    text: `Question ${id}`,
    type: "text",
    weight,
    required: false,
    conditions: [],
  };
}

function makeBoolQuestion(id: string, sectionId: string, weight = 5): AssessmentQuestion {
  return {
    id,
    sectionId,
    text: `Question ${id}`,
    type: "boolean",
    weight,
    required: false,
    conditions: [],
  };
}

function makeNumericQuestion(
  id: string,
  sectionId: string,
  weight = 5,
  min = 0,
  max = 10
): AssessmentQuestion {
  return {
    id,
    sectionId,
    text: `Question ${id}`,
    type: "numeric",
    weight,
    required: false,
    numericMin: min,
    numericMax: max,
    conditions: [],
  };
}

function makeMultipleChoiceQuestion(
  id: string,
  sectionId: string,
  weight = 5
): AssessmentQuestion {
  return {
    id,
    sectionId,
    text: `Question ${id}`,
    type: "multiple_choice",
    weight,
    required: false,
    options: [
      { id: "opt1", label: "Option 1", value: "opt1", numericValue: 0.25 },
      { id: "opt2", label: "Option 2", value: "opt2", numericValue: 0.5 },
      { id: "opt3", label: "Option 3", value: "opt3", numericValue: 0.75 },
      { id: "opt4", label: "Option 4", value: "opt4", numericValue: 1.0 },
    ],
    conditions: [],
  };
}

function makeResponse(questionId: string, answer: string | boolean | number | string[]): QuestionResponse {
  return { questionId, answer, answeredAt: "2026-03-23T00:00:00Z" };
}

// ─── normalizeAnswer() tests ──────────────────────────────────────────────────

describe("normalizeAnswer()", () => {
  it("returns 1.0 for boolean true", () => {
    const q = makeBoolQuestion("q1", "s1");
    expect(normalizeAnswer(q, true)).toBe(1.0);
  });

  it("returns 0.0 for boolean false", () => {
    const q = makeBoolQuestion("q1", "s1");
    expect(normalizeAnswer(q, false)).toBe(0.0);
  });

  it("returns 0.0 for null/undefined boolean", () => {
    const q = makeBoolQuestion("q1", "s1");
    expect(normalizeAnswer(q, null as unknown as boolean)).toBe(0.0);
    expect(normalizeAnswer(q, undefined as unknown as boolean)).toBe(0.0);
  });

  it("returns 0.7 for numeric 7 with min=0 max=10", () => {
    const q = makeNumericQuestion("q1", "s1", 5, 0, 10);
    expect(normalizeAnswer(q, 7)).toBe(0.7);
  });

  it("returns numericValue 0.8 for multiple_choice option with numericValue=0.8", () => {
    const q: AssessmentQuestion = {
      id: "q1",
      sectionId: "s1",
      text: "Question q1",
      type: "multiple_choice",
      weight: 5,
      required: false,
      options: [
        { id: "opt1", label: "Option A", value: "optA", numericValue: 0.8 },
      ],
      conditions: [],
    };
    expect(normalizeAnswer(q, "optA")).toBe(0.8);
  });

  it("returns 1.0 for text question (always full score)", () => {
    const q = makeTextQuestion("q1", "s1");
    expect(normalizeAnswer(q, "some answer")).toBe(1.0);
  });

  it("returns 1.0 for text question with empty string", () => {
    const q = makeTextQuestion("q1", "s1");
    expect(normalizeAnswer(q, "")).toBe(1.0);
  });

  it("returns 0.0 for null answer on any question type", () => {
    const q = makeNumericQuestion("q1", "s1");
    expect(normalizeAnswer(q, null as unknown as number)).toBe(0.0);
  });
});

// ─── isQuestionVisible() tests ────────────────────────────────────────────────

describe("isQuestionVisible()", () => {
  it("returns true when question has no conditions", () => {
    const q = makeTextQuestion("q1", "s1");
    expect(isQuestionVisible(q, {}, [])).toBe(true);
  });

  it("returns true when equals condition matches (action=show)", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "equals", value: "yes", action: "show" },
      ],
    };
    const responses = { q1: makeResponse("q1", "yes") };
    expect(isQuestionVisible(q, responses, [])).toBe(true);
  });

  it("returns false when equals condition does not match (action=show)", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "equals", value: "yes", action: "show" },
      ],
    };
    const responses = { q1: makeResponse("q1", "no") };
    expect(isQuestionVisible(q, responses, [])).toBe(false);
  });

  it("returns true when contains operator matches substring", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "contains", value: "cloud", action: "show" },
      ],
    };
    const responses = { q1: makeResponse("q1", "AWS cloud provider") };
    expect(isQuestionVisible(q, responses, [])).toBe(true);
  });

  it("returns true when greater_than operator passes", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "greater_than", value: 5, action: "show" },
      ],
    };
    const responses = { q1: makeResponse("q1", 7) };
    expect(isQuestionVisible(q, responses, [])).toBe(true);
  });

  it("returns false when greater_than operator does not pass (equal value)", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "greater_than", value: 5, action: "show" },
      ],
    };
    const responses = { q1: makeResponse("q1", 5) };
    expect(isQuestionVisible(q, responses, [])).toBe(false);
  });

  it("hides question when action=hide and condition is met", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "equals", value: "skip", action: "hide" },
      ],
    };
    const responses = { q1: makeResponse("q1", "skip") };
    expect(isQuestionVisible(q, responses, [])).toBe(false);
  });

  it("remains visible when action=hide but condition is not met", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "equals", value: "skip", action: "hide" },
      ],
    };
    const responses = { q1: makeResponse("q1", "proceed") };
    expect(isQuestionVisible(q, responses, [])).toBe(true);
  });

  it("returns false (hidden) when action=show and referenced question has no response", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "equals", value: "yes", action: "show" },
      ],
    };
    expect(isQuestionVisible(q, {}, [])).toBe(false);
  });

  it("returns true (visible) when action=hide and referenced question has no response", () => {
    const q: AssessmentQuestion = {
      ...makeTextQuestion("q2", "s1"),
      conditions: [
        { questionId: "q1", operator: "equals", value: "yes", action: "hide" },
      ],
    };
    expect(isQuestionVisible(q, {}, [])).toBe(true);
  });
});

// ─── computeScore() tests ─────────────────────────────────────────────────────

describe("computeScore()", () => {
  function makeTemplate(): AssessmentTemplateQuestions {
    const s1Questions: AssessmentQuestion[] = [
      makeBoolQuestion("q1", "s1", 5),
      makeBoolQuestion("q2", "s1", 5),
      makeBoolQuestion("q3", "s1", 5),
    ];
    const s2Questions: AssessmentQuestion[] = [
      makeBoolQuestion("q4", "s2", 5),
      makeBoolQuestion("q5", "s2", 5),
      makeBoolQuestion("q6", "s2", 5),
    ];
    const sections: AssessmentSection[] = [
      { id: "s1", name: "Section 1", order: 1, questions: s1Questions },
      { id: "s2", name: "Section 2", order: 2, questions: s2Questions },
    ];
    return { sections, version: 1 };
  }

  function makeFullResponses(): AssessmentResponses {
    return {
      currentSectionIndex: 0,
      responses: {
        q1: makeResponse("q1", true),
        q2: makeResponse("q2", true),
        q3: makeResponse("q3", true),
        q4: makeResponse("q4", true),
        q5: makeResponse("q5", true),
        q6: makeResponse("q6", true),
      },
      aiFollowUps: [],
      completedSections: [],
    };
  }

  it("returns overall score between 0 and 100 for fully answered assessment", () => {
    const template = makeTemplate();
    const responses = makeFullResponses();
    const result = computeScore(template, responses);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it("returns identical result across 100 invocations (deterministic)", () => {
    const template = makeTemplate();
    const responses = makeFullResponses();
    const first = computeScore(template, responses);
    for (let i = 0; i < 99; i++) {
      const result = computeScore(template, responses);
      expect(result.overall).toBe(first.overall);
      result.sections.forEach((s, idx) => {
        expect(s.score).toBe(first.sections[idx].score);
      });
    }
  });

  it("excludes hidden question from denominator (action=show, condition not met)", () => {
    // q2 is shown only if q1 = "yes", but q1 = "no" so q2 is hidden
    const questions: AssessmentQuestion[] = [
      makeBoolQuestion("q1", "s1", 5),
      {
        ...makeBoolQuestion("q2", "s1", 5),
        conditions: [{ questionId: "q1", operator: "equals", value: "true", action: "show" }],
      },
      makeBoolQuestion("q3", "s1", 5),
    ];
    const template: AssessmentTemplateQuestions = {
      sections: [{ id: "s1", name: "Section 1", order: 1, questions }],
      version: 1,
    };
    // q1=false (0.0), q2 hidden, q3=true (1.0)
    const responses: AssessmentResponses = {
      currentSectionIndex: 0,
      responses: {
        q1: makeResponse("q1", false),
        q3: makeResponse("q3", true),
      },
      aiFollowUps: [],
      completedSections: [],
    };
    const result = computeScore(template, responses);
    // Visible: q1 (score=0, weight=5), q3 (score=1.0, weight=5)
    // Section score = (0*5 + 1.0*5) / (5+5) * 100 = 50.00
    expect(result.sections[0].score).toBe(50);
    expect(result.sections[0].questionScores).toHaveLength(2);
  });

  it("includes question shown by branching condition (action=show, condition met)", () => {
    const questions: AssessmentQuestion[] = [
      makeBoolQuestion("q1", "s1", 5),
      {
        ...makeBoolQuestion("q2", "s1", 5),
        conditions: [{ questionId: "q1", operator: "equals", value: "true", action: "show" }],
      },
    ];
    const template: AssessmentTemplateQuestions = {
      sections: [{ id: "s1", name: "Section 1", order: 1, questions }],
      version: 1,
    };
    // q1=true triggers show of q2; q2=true
    const responses: AssessmentResponses = {
      currentSectionIndex: 0,
      responses: {
        q1: makeResponse("q1", true),
        q2: makeResponse("q2", true),
      },
      aiFollowUps: [],
      completedSections: [],
    };
    const result = computeScore(template, responses);
    // Both visible: q1(1.0*5) + q2(1.0*5) / (5+5) * 100 = 100
    expect(result.sections[0].score).toBe(100);
    expect(result.sections[0].questionScores).toHaveLength(2);
  });

  it("rounds section scores to 2 decimal places", () => {
    const questions: AssessmentQuestion[] = [
      makeNumericQuestion("q1", "s1", 5, 0, 3),
    ];
    const template: AssessmentTemplateQuestions = {
      sections: [{ id: "s1", name: "Section 1", order: 1, questions }],
      version: 1,
    };
    const responses: AssessmentResponses = {
      currentSectionIndex: 0,
      responses: { q1: makeResponse("q1", 1) }, // 1/3 = 0.3333...
      aiFollowUps: [],
      completedSections: [],
    };
    const result = computeScore(template, responses);
    // score = (1/3) * 100 = 33.33
    expect(result.sections[0].score).toBe(33.33);
  });

  it("rounds overall score to 2 decimal places", () => {
    const s1Questions: AssessmentQuestion[] = [makeNumericQuestion("q1", "s1", 5, 0, 3)];
    const s2Questions: AssessmentQuestion[] = [makeNumericQuestion("q2", "s2", 5, 0, 3)];
    const template: AssessmentTemplateQuestions = {
      sections: [
        { id: "s1", name: "Section 1", order: 1, questions: s1Questions },
        { id: "s2", name: "Section 2", order: 2, questions: s2Questions },
      ],
      version: 1,
    };
    const responses: AssessmentResponses = {
      currentSectionIndex: 0,
      responses: {
        q1: makeResponse("q1", 1), // 33.33
        q2: makeResponse("q2", 2), // 66.67
      },
      aiFollowUps: [],
      completedSections: [],
    };
    const result = computeScore(template, responses);
    // overall = (33.33 + 66.67) / 2 = 50.00
    expect(result.overall).toBe(50);
    expect(Number.isFinite(result.overall)).toBe(true);
  });
});
