import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, assessmentTemplatesTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";
import type { AssessmentTemplateQuestions } from "../lib/assessment-engine";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

const PREBUILT_PREFIX = "[PREBUILT]";

function isPrebuilt(description: string | null | undefined): boolean {
  return typeof description === "string" && description.startsWith(PREBUILT_PREFIX);
}

function toPublicTemplate(template: typeof assessmentTemplatesTable.$inferSelect) {
  return {
    ...template,
    isPrebuilt: isPrebuilt(template.description),
    description: template.description?.startsWith(PREBUILT_PREFIX)
      ? template.description.slice(PREBUILT_PREFIX.length).trimStart()
      : template.description,
  };
}

const router = Router();

router.get("/v1/assessment-templates", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { contextType } = req.query;

    const conditions = [eq(assessmentTemplatesTable.tenantId, tenantId)];
    if (contextType === "vendor" || contextType === "framework") {
      conditions.push(eq(assessmentTemplatesTable.contextType, contextType));
    }

    const templates = await db
      .select()
      .from(assessmentTemplatesTable)
      .where(and(...conditions))
      .orderBy(desc(assessmentTemplatesTable.createdAt));

    res.json({ data: templates.map(toPublicTemplate) });
  } catch (err) {
    console.error("List assessment templates error:", err);
    serverError(res);
  }
});

router.get("/v1/assessment-templates/:id", async (req, res) => {
  try {
    const [template] = await db
      .select()
      .from(assessmentTemplatesTable)
      .where(
        and(
          eq(assessmentTemplatesTable.id, p(req, "id")),
          eq(assessmentTemplatesTable.tenantId, req.user!.tenantId),
        ),
      )
      .limit(1);

    if (!template) { notFound(res, "Assessment template not found"); return; }
    res.json(toPublicTemplate(template));
  } catch (err) {
    console.error("Get assessment template error:", err);
    serverError(res);
  }
});

router.post(
  "/v1/assessment-templates",
  requireRole("admin", "risk_manager"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { title, description, questions, contextType } = req.body;

      if (!title) { badRequest(res, "title is required"); return; }
      if (!contextType || !["vendor", "framework"].includes(contextType)) {
        badRequest(res, "contextType must be 'vendor' or 'framework'");
        return;
      }
      if (!questions || !Array.isArray(questions.sections)) {
        badRequest(res, "questions.sections must be an array");
        return;
      }

      const templateQuestions = questions as AssessmentTemplateQuestions;

      const [template] = await db
        .insert(assessmentTemplatesTable)
        .values({
          tenantId,
          title,
          description: description || null,
          questions: templateQuestions,
          contextType,
          version: 1,
        })
        .returning();

      await recordAudit(req, "create", "assessment_template", template.id);
      res.status(201).json(toPublicTemplate(template));
    } catch (err) {
      console.error("Create assessment template error:", err);
      serverError(res);
    }
  },
);

router.patch(
  "/v1/assessment-templates/:id",
  requireRole("admin", "risk_manager"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const templateId = p(req, "id");

      const [existing] = await db
        .select()
        .from(assessmentTemplatesTable)
        .where(
          and(
            eq(assessmentTemplatesTable.id, templateId),
            eq(assessmentTemplatesTable.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) { notFound(res, "Assessment template not found"); return; }

      if (isPrebuilt(existing.description)) {
        badRequest(res, "Pre-built templates cannot be modified. Clone it to customize.");
        return;
      }

      const { title, description, questions } = req.body;

      const updates: Partial<{
        title: string;
        description: string | null;
        questions: AssessmentTemplateQuestions;
        version: number;
        updatedAt: Date;
      }> = {
        updatedAt: new Date(),
        version: (existing.version ?? 1) + 1,
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(questions !== undefined && { questions: questions as AssessmentTemplateQuestions }),
      };

      const [updated] = await db
        .update(assessmentTemplatesTable)
        .set(updates)
        .where(
          and(
            eq(assessmentTemplatesTable.id, templateId),
            eq(assessmentTemplatesTable.tenantId, tenantId),
          ),
        )
        .returning();

      if (!updated) { notFound(res, "Assessment template not found"); return; }

      await recordAudit(req, "update", "assessment_template", updated.id);
      res.json(toPublicTemplate(updated));
    } catch (err) {
      console.error("Update assessment template error:", err);
      serverError(res);
    }
  },
);

router.delete(
  "/v1/assessment-templates/:id",
  requireRole("admin"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const templateId = p(req, "id");

      const [existing] = await db
        .select()
        .from(assessmentTemplatesTable)
        .where(
          and(
            eq(assessmentTemplatesTable.id, templateId),
            eq(assessmentTemplatesTable.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) { notFound(res, "Assessment template not found"); return; }

      if (isPrebuilt(existing.description)) {
        badRequest(res, "Pre-built templates cannot be deleted. Clone it to customize.");
        return;
      }

      await db
        .delete(assessmentTemplatesTable)
        .where(
          and(
            eq(assessmentTemplatesTable.id, templateId),
            eq(assessmentTemplatesTable.tenantId, tenantId),
          ),
        );

      await recordAudit(req, "delete", "assessment_template", templateId);
      res.json({ deleted: true, id: templateId });
    } catch (err) {
      console.error("Delete assessment template error:", err);
      serverError(res);
    }
  },
);

router.post(
  "/v1/assessment-templates/:id/clone",
  requireRole("admin", "risk_manager"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const templateId = p(req, "id");

      const [existing] = await db
        .select()
        .from(assessmentTemplatesTable)
        .where(
          and(
            eq(assessmentTemplatesTable.id, templateId),
            eq(assessmentTemplatesTable.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) { notFound(res, "Assessment template not found"); return; }

      const cleanDescription = existing.description?.startsWith(PREBUILT_PREFIX)
        ? existing.description.slice(PREBUILT_PREFIX.length).trimStart()
        : existing.description;

      const [cloned] = await db
        .insert(assessmentTemplatesTable)
        .values({
          tenantId,
          title: `${existing.title} (Copy)`,
          description: cleanDescription || null,
          questions: existing.questions as AssessmentTemplateQuestions,
          contextType: existing.contextType,
          version: 1,
        })
        .returning();

      await recordAudit(req, "clone", "assessment_template", cloned.id, { sourceId: templateId });
      res.status(201).json(toPublicTemplate(cloned));
    } catch (err) {
      console.error("Clone assessment template error:", err);
      serverError(res);
    }
  },
);

export default router;
