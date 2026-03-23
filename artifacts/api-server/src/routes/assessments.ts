import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  assessmentsTable,
  assessmentTemplatesTable,
  vendorsTable,
  frameworksTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";
import { streamComplete, complete, LLMUnavailableError } from "../lib/llm-service";
import { computeTierFromRiskScore } from "../lib/allowed-transitions";
import { enqueueJob, registerWorker } from "../lib/job-queue";
import {
  computeScore,
  type AssessmentTemplateQuestions,
  type AssessmentResponses,
  type QuestionResponse,
} from "../lib/assessment-engine";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

function buildSummaryPrompt(
  template: typeof assessmentTemplatesTable.$inferSelect,
  assessment: typeof assessmentsTable.$inferSelect,
): string {
  const templateQuestions = template.questions as AssessmentTemplateQuestions;
  const responses = assessment.responses as AssessmentResponses;
  const allResponses = responses?.responses ?? {};

  const qaPairs: string[] = [];
  for (const section of templateQuestions.sections ?? []) {
    qaPairs.push(`\n## ${section.name}`);
    for (const question of section.questions) {
      const resp = allResponses[question.id];
      if (resp) {
        qaPairs.push(`Q: ${question.text}`);
        qaPairs.push(`A: ${JSON.stringify(resp.answer)}`);
      }
    }
  }

  return `You are a risk management expert analyzing assessment responses. The assessment "${template.title}" has been completed with the following Q&A pairs:

${qaPairs.join("\n")}

Please analyze these responses and provide a summary that highlights:
1) Key anomalies or inconsistencies in the responses
2) Gaps in coverage or unanswered areas
3) Areas of concern that warrant further investigation
4) Overall assessment quality and completeness

Provide a concise, professional summary suitable for executive review.`;
}

// ─── Risk Score Update Hook ────────────────────────────────────────────────────
// Risk score convention: 0 = low risk (best), 100 = critical risk (worst)
// Assessment Engine overall: 0-100 where 100 = perfect compliance
// Conversion: riskScore = 100 - assessment.overall

/**
 * When an assessment with contextType='vendor' is completed, update the vendor's
 * riskScore using the assessment engine score. Safe to call for non-vendor assessments.
 */
async function updateVendorRiskScoreFromAssessment(
  assessment: { contextType: string; contextId: string | null; templateId: string; responses: unknown },
  tenantId: string,
): Promise<void> {
  if (assessment.contextType !== "vendor" || !assessment.contextId) return;

  // Load template to get questions
  const [template] = await db
    .select({ questions: assessmentTemplatesTable.questions })
    .from(assessmentTemplatesTable)
    .where(eq(assessmentTemplatesTable.id, assessment.templateId))
    .limit(1);
  if (!template) return;

  const score = computeScore(
    template.questions as AssessmentTemplateQuestions,
    assessment.responses as AssessmentResponses,
  );

  const riskScore = Math.round((100 - score.overall) * 100) / 100;

  // Load vendor to check overrideTier
  const [vendor] = await db
    .select({ tier: vendorsTable.tier, overrideTier: vendorsTable.overrideTier })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, assessment.contextId))
    .limit(1);
  if (!vendor) return;

  const newTier = vendor.overrideTier ?? computeTierFromRiskScore(riskScore);

  await db
    .update(vendorsTable)
    .set({
      riskScore: String(riskScore),
      ...(!vendor.overrideTier && { tier: newTier }),
      updatedAt: new Date(),
    })
    .where(eq(vendorsTable.id, assessment.contextId!));
}

// Register AI summary worker for assessments
registerWorker("ai-assess", async (job) => {
  const { assessmentId } = job.payload as { assessmentId: string };

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, assessmentId))
    .limit(1);

  if (!assessment) return { status: "not_found" };

  const [template] = await db
    .select()
    .from(assessmentTemplatesTable)
    .where(eq(assessmentTemplatesTable.id, assessment.templateId))
    .limit(1);

  if (!template) return { status: "template_not_found" };

  const tenantId = assessment.tenantId;

  try {
    const prompt = buildSummaryPrompt(template, assessment);
    const summary = await complete(
      tenantId,
      { messages: [{ role: "user", content: prompt }] },
      "assessment",
    );

    await db
      .update(assessmentsTable)
      .set({ aiSummary: summary, updatedAt: new Date() })
      .where(eq(assessmentsTable.id, assessmentId));

    return { status: "completed" };
  } catch (err) {
    console.error(`[AI Assess] Summary generation failed for assessment ${assessmentId}:`, err);
    return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
});

const router = Router();

// GET /v1/assessments - list assessments for tenant
router.get("/v1/assessments", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, contextType } = req.query;

    const conditions = [eq(assessmentsTable.tenantId, tenantId)];

    if (status && ["draft", "active", "completed", "abandoned"].includes(String(status))) {
      conditions.push(
        eq(assessmentsTable.status, status as "draft" | "active" | "completed" | "abandoned"),
      );
    }
    if (contextType && ["vendor", "framework"].includes(String(contextType))) {
      conditions.push(
        eq(assessmentsTable.contextType, contextType as "vendor" | "framework"),
      );
    }

    const assessments = await db
      .select({
        id: assessmentsTable.id,
        tenantId: assessmentsTable.tenantId,
        templateId: assessmentsTable.templateId,
        templateTitle: assessmentTemplatesTable.title,
        contextType: assessmentsTable.contextType,
        contextId: assessmentsTable.contextId,
        status: assessmentsTable.status,
        score: assessmentsTable.score,
        createdAt: assessmentsTable.createdAt,
        updatedAt: assessmentsTable.updatedAt,
      })
      .from(assessmentsTable)
      .leftJoin(assessmentTemplatesTable, eq(assessmentsTable.templateId, assessmentTemplatesTable.id))
      .where(and(...conditions))
      .orderBy(desc(assessmentsTable.updatedAt));

    res.json({ data: assessments });
  } catch (err) {
    console.error("List assessments error:", err);
    serverError(res);
  }
});

// GET /v1/assessments/:id - get single assessment
router.get("/v1/assessments/:id", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const assessmentId = p(req, "id");

    const [result] = await db
      .select({
        id: assessmentsTable.id,
        tenantId: assessmentsTable.tenantId,
        templateId: assessmentsTable.templateId,
        contextType: assessmentsTable.contextType,
        contextId: assessmentsTable.contextId,
        status: assessmentsTable.status,
        responses: assessmentsTable.responses,
        score: assessmentsTable.score,
        aiSummary: assessmentsTable.aiSummary,
        createdAt: assessmentsTable.createdAt,
        updatedAt: assessmentsTable.updatedAt,
        template: {
          id: assessmentTemplatesTable.id,
          title: assessmentTemplatesTable.title,
          description: assessmentTemplatesTable.description,
          questions: assessmentTemplatesTable.questions,
          contextType: assessmentTemplatesTable.contextType,
          version: assessmentTemplatesTable.version,
        },
      })
      .from(assessmentsTable)
      .leftJoin(assessmentTemplatesTable, eq(assessmentsTable.templateId, assessmentTemplatesTable.id))
      .where(
        and(
          eq(assessmentsTable.id, assessmentId),
          eq(assessmentsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!result) { notFound(res, "Assessment not found"); return; }
    res.json(result);
  } catch (err) {
    console.error("Get assessment error:", err);
    serverError(res);
  }
});

// POST /v1/assessments - create assessment from template
router.post("/v1/assessments", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { templateId, contextType, contextId } = req.body;

    if (!templateId) { badRequest(res, "templateId is required"); return; }
    if (!contextType || !["vendor", "framework"].includes(contextType)) {
      badRequest(res, "contextType must be 'vendor' or 'framework'");
      return;
    }
    if (!contextId) { badRequest(res, "contextId is required"); return; }

    // Verify template belongs to tenant
    const [template] = await db
      .select({ id: assessmentTemplatesTable.id })
      .from(assessmentTemplatesTable)
      .where(
        and(
          eq(assessmentTemplatesTable.id, templateId),
          eq(assessmentTemplatesTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!template) { notFound(res, "Assessment template not found"); return; }

    // Verify contextId references a valid entity
    if (contextType === "vendor") {
      const [vendor] = await db
        .select({ id: vendorsTable.id })
        .from(vendorsTable)
        .where(and(eq(vendorsTable.id, contextId), eq(vendorsTable.tenantId, tenantId)))
        .limit(1);
      if (!vendor) { notFound(res, "Vendor not found"); return; }
    } else {
      const [framework] = await db
        .select({ id: frameworksTable.id })
        .from(frameworksTable)
        .where(and(eq(frameworksTable.id, contextId), eq(frameworksTable.tenantId, tenantId)))
        .limit(1);
      if (!framework) { notFound(res, "Framework not found"); return; }
    }

    const initialResponses: AssessmentResponses = {
      currentSectionIndex: 0,
      responses: {},
      aiFollowUps: [],
      completedSections: [],
    };

    const [assessment] = await db
      .insert(assessmentsTable)
      .values({
        tenantId,
        templateId,
        contextType,
        contextId,
        status: "active",
        responses: initialResponses,
      })
      .returning();

    await recordAudit(req, "create", "assessment", assessment.id, { templateId, contextType, contextId });
    res.status(201).json(assessment);
  } catch (err) {
    console.error("Create assessment error:", err);
    serverError(res);
  }
});

// PATCH /v1/assessments/:id/responses - save session progress
router.patch(
  "/v1/assessments/:id/responses",
  requireRole("admin", "risk_manager", "auditor"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const assessmentId = p(req, "id");

      const [existing] = await db
        .select()
        .from(assessmentsTable)
        .where(
          and(
            eq(assessmentsTable.id, assessmentId),
            eq(assessmentsTable.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) { notFound(res, "Assessment not found"); return; }

      if (existing.status === "completed" || existing.status === "abandoned") {
        badRequest(res, `Cannot update responses on a ${existing.status} assessment`);
        return;
      }

      const { currentSectionIndex, responses, aiFollowUps, completedSections } = req.body;

      const updatedResponses: AssessmentResponses = {
        currentSectionIndex: currentSectionIndex ?? 0,
        responses: (responses as Record<string, QuestionResponse>) ?? {},
        aiFollowUps: aiFollowUps ?? [],
        completedSections: completedSections ?? [],
      };

      const [updated] = await db
        .update(assessmentsTable)
        .set({ responses: updatedResponses, updatedAt: new Date() })
        .where(
          and(
            eq(assessmentsTable.id, assessmentId),
            eq(assessmentsTable.tenantId, tenantId),
          ),
        )
        .returning();

      if (!updated) { notFound(res, "Assessment not found"); return; }
      res.json(updated);
    } catch (err) {
      console.error("Update assessment responses error:", err);
      serverError(res);
    }
  },
);

// POST /v1/assessments/:id/submit - submit and compute score
router.post(
  "/v1/assessments/:id/submit",
  requireRole("admin", "risk_manager"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const assessmentId = p(req, "id");

      const [assessment] = await db
        .select()
        .from(assessmentsTable)
        .where(
          and(
            eq(assessmentsTable.id, assessmentId),
            eq(assessmentsTable.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!assessment) { notFound(res, "Assessment not found"); return; }
      if (assessment.status === "completed") {
        badRequest(res, "Assessment has already been completed");
        return;
      }
      if (assessment.status === "abandoned") {
        badRequest(res, "Cannot submit an abandoned assessment");
        return;
      }

      const [template] = await db
        .select()
        .from(assessmentTemplatesTable)
        .where(eq(assessmentTemplatesTable.id, assessment.templateId))
        .limit(1);

      if (!template) { notFound(res, "Assessment template not found"); return; }

      const templateQuestions = template.questions as AssessmentTemplateQuestions;
      const responses = assessment.responses as AssessmentResponses;

      const scoreResult = computeScore(templateQuestions, responses);

      const [updated] = await db
        .update(assessmentsTable)
        .set({
          status: "completed",
          score: scoreResult.overall.toString(),
          updatedAt: new Date(),
        })
        .where(eq(assessmentsTable.id, assessmentId))
        .returning();

      // Update vendor risk score if this is a vendor-context assessment
      await updateVendorRiskScoreFromAssessment(assessment, tenantId);

      const job = await enqueueJob(
        "ai-assess",
        "summarize_assessment",
        { assessmentId },
        tenantId,
      );

      await recordAudit(req, "submit", "assessment", assessmentId, {
        score: scoreResult.overall,
      });

      res.json({ assessmentId, score: scoreResult, jobId: job.id, assessment: updated });
    } catch (err) {
      console.error("Submit assessment error:", err);
      serverError(res);
    }
  },
);

// POST /v1/assessments/:id/follow-up - SSE endpoint for AI follow-up generation
router.post("/v1/assessments/:id/follow-up", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const assessmentId = p(req, "id");

    const [assessment] = await db
      .select({ id: assessmentsTable.id })
      .from(assessmentsTable)
      .where(
        and(
          eq(assessmentsTable.id, assessmentId),
          eq(assessmentsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!assessment) { notFound(res, "Assessment not found"); return; }

    const { questionId, questionText, answer, sectionResponses } = req.body;

    if (!questionId) { badRequest(res, "questionId is required"); return; }

    const prompt = `You are evaluating assessment responses. The user just answered question '${questionText || questionId}' with '${answer !== undefined ? JSON.stringify(answer) : "not provided"}'. Based on this response and the context of the assessment, determine if a follow-up question would help clarify or explore the answer further. If yes, respond with a JSON object: { "text": "...", "type": "boolean|text|multiple_choice|numeric", "weight": 5, "required": false }. If no follow-up is needed, respond with null.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let fullResponse = "";
    try {
      for await (const chunk of streamComplete(
        tenantId,
        { messages: [{ role: "user", content: prompt }] },
        "assessment",
      )) {
        if (chunk.type === "text") {
          fullResponse += chunk.content;
          res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
        } else if (chunk.type === "done") {
          // Parse the response to extract follow-up question
          let followUp = null;
          try {
            const cleaned = fullResponse
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim();
            if (cleaned !== "null" && cleaned !== "") {
              const parsed = JSON.parse(cleaned);
              if (parsed && typeof parsed === "object" && parsed.text) {
                followUp = parsed;
              }
            }
          } catch {
            // Not parseable JSON — no follow-up
            followUp = null;
          }

          res.write(`data: ${JSON.stringify({ type: "done", followUp })}\n\n`);
        }
      }
    } catch (err) {
      const errMsg = err instanceof LLMUnavailableError
        ? err.message
        : (err instanceof Error ? err.message : "Stream error");
      res.write(`data: ${JSON.stringify({ type: "error", content: errMsg })}\n\n`);
    }

    res.end();
  } catch (err) {
    console.error("Assessment follow-up error:", err);
    if (!res.headersSent) {
      serverError(res);
    }
  }
});

// POST /v1/assessments/:id/abandon - abandon assessment
router.post(
  "/v1/assessments/:id/abandon",
  requireRole("admin", "risk_manager"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const assessmentId = p(req, "id");

      const [existing] = await db
        .select()
        .from(assessmentsTable)
        .where(
          and(
            eq(assessmentsTable.id, assessmentId),
            eq(assessmentsTable.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) { notFound(res, "Assessment not found"); return; }
      if (existing.status === "completed") {
        badRequest(res, "Cannot abandon a completed assessment");
        return;
      }

      const [updated] = await db
        .update(assessmentsTable)
        .set({ status: "abandoned", updatedAt: new Date() })
        .where(
          and(
            eq(assessmentsTable.id, assessmentId),
            eq(assessmentsTable.tenantId, tenantId),
          ),
        )
        .returning();

      await recordAudit(req, "abandon", "assessment", assessmentId);
      res.json(updated);
    } catch (err) {
      console.error("Abandon assessment error:", err);
      serverError(res);
    }
  },
);

// GET /v1/assessments/:id/results - get completed assessment with full score breakdown
router.get("/v1/assessments/:id/results", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const assessmentId = p(req, "id");

    const [assessment] = await db
      .select()
      .from(assessmentsTable)
      .where(
        and(
          eq(assessmentsTable.id, assessmentId),
          eq(assessmentsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!assessment) { notFound(res, "Assessment not found"); return; }
    if (assessment.status !== "completed") {
      badRequest(res, "Assessment is not yet completed");
      return;
    }

    const [template] = await db
      .select()
      .from(assessmentTemplatesTable)
      .where(eq(assessmentTemplatesTable.id, assessment.templateId))
      .limit(1);

    if (!template) { notFound(res, "Assessment template not found"); return; }

    const templateQuestions = template.questions as AssessmentTemplateQuestions;
    const responses = assessment.responses as AssessmentResponses;
    const fullScore = computeScore(templateQuestions, responses);

    res.json({ assessment, score: fullScore, template });
  } catch (err) {
    console.error("Get assessment results error:", err);
    serverError(res);
  }
});

export default router;
