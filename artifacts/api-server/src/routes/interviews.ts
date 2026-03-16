import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, interviewSessionsTable, risksTable, controlTestsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, sendError } from "../lib/errors";
import { complete, streamComplete, isAvailable, LLMUnavailableError } from "../lib/llm-service";

const router = Router();

const RISK_SYSTEM_PROMPT = `You are a risk management interview assistant. You help users identify and document enterprise risks through a structured conversation. Ask focused questions one at a time about:
1. What is the risk? (title/description)
2. What category does it fall under? (operational, financial, compliance, strategic, technology, reputational)
3. What is the likelihood? (1-5 scale)
4. What is the potential impact? (1-5 scale)
5. Who should own this risk?
6. What controls exist or are needed?

After gathering enough information, synthesize a draft risk record. Respond in JSON when you have a complete draft:
{"type":"draft","data":{"title":"...","description":"...","category":"...","likelihood":N,"impact":N}}
Otherwise respond with:
{"type":"question","content":"your next question"}`;

const CONTROL_SYSTEM_PROMPT = `You are a control assessment interview assistant. You help users assess the effectiveness of security and compliance controls through structured questions:
1. What control is being assessed?
2. Is the control implemented? (yes/partial/no)
3. What evidence exists for the control?
4. When was it last tested?
5. What gaps or weaknesses exist?
6. What is the overall effectiveness? (effective, partially_effective, ineffective)

After gathering enough information, synthesize an assessment. Respond in JSON when complete:
{"type":"draft","data":{"result":"effective|partially_effective|ineffective","notes":"...","gaps":["..."]}}
Otherwise respond with:
{"type":"question","content":"your next question"}`;

function getSystemPrompt(type: string): string {
  return type === "risk_creation" ? RISK_SYSTEM_PROMPT : CONTROL_SYSTEM_PROMPT;
}

router.post("/v1/interviews", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const { type } = req.body;

    if (!type || !["risk_creation", "control_assessment"].includes(type)) {
      badRequest(res, "type must be 'risk_creation' or 'control_assessment'");
      return;
    }

    const available = await isAvailable(tenantId);
    if (!available) {
      badRequest(res, "AI unavailable — no LLM provider configured");
      return;
    }

    const systemPrompt = getSystemPrompt(type);
    let greeting: string;
    try {
      greeting = await complete(tenantId, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Start the interview." },
        ],
      });
    } catch (err) {
      console.error("Interview start LLM error:", err);
      greeting = '{"type":"question","content":"Let\'s begin. Can you describe the risk you\'d like to document?"}';
    }

    const transcript = [
      { role: "assistant", content: greeting, timestamp: new Date().toISOString() },
    ];

    const [session] = await db.insert(interviewSessionsTable).values({
      tenantId,
      userId,
      type,
      transcript,
    }).returning();

    await recordAudit(req, "interview_started", "interview_session", session.id, { type });
    res.status(201).json(session);
  } catch (err) {
    console.error("Start interview error:", err);
    serverError(res);
  }
});

router.get("/v1/interviews/:id", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [session] = await db.select().from(interviewSessionsTable)
      .where(and(
        eq(interviewSessionsTable.id, String(req.params.id)),
        eq(interviewSessionsTable.tenantId, tenantId),
      )).limit(1);

    if (!session) { notFound(res, "Interview session not found"); return; }
    res.json(session);
  } catch (err) {
    console.error("Get interview error:", err);
    serverError(res);
  }
});

router.post("/v1/interviews/:id/message", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessionId = String(req.params.id);
    const { content } = req.body;

    if (!content) { badRequest(res, "content is required"); return; }

    const [session] = await db.select().from(interviewSessionsTable)
      .where(and(
        eq(interviewSessionsTable.id, sessionId),
        eq(interviewSessionsTable.tenantId, tenantId),
      )).limit(1);

    if (!session) { notFound(res, "Interview session not found"); return; }
    if (session.status !== "active") { badRequest(res, "Interview session is not active"); return; }

    const transcript = (session.transcript as any[]) || [];
    transcript.push({ role: "user", content, timestamp: new Date().toISOString() });

    await db.update(interviewSessionsTable).set({
      transcript,
      updatedAt: new Date(),
    }).where(eq(interviewSessionsTable.id, sessionId));

    const systemPrompt = getSystemPrompt(session.type);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...transcript.map((t: any) => ({ role: t.role as "user" | "assistant", content: t.content })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullResponse = "";
    try {
      for await (const chunk of streamComplete(tenantId, { messages })) {
        if (chunk.type === "text") {
          fullResponse += chunk.content;
          res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
        } else if (chunk.type === "done") {
          transcript.push({ role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });

          let draftData = session.draftData;
          try {
            const parsed = JSON.parse(fullResponse);
            if (parsed.type === "draft" && parsed.data) {
              draftData = parsed.data;
            }
          } catch {}

          await db.update(interviewSessionsTable).set({
            transcript,
            draftData,
            updatedAt: new Date(),
          }).where(eq(interviewSessionsTable.id, sessionId));

          res.write(`data: ${JSON.stringify({ type: "done", draftData })}\n\n`);
        }
      }
    } catch (err) {
      console.error("Interview stream error:", err);
      transcript.push({ role: "assistant", content: `[error] ${err instanceof Error ? err.message : "Stream error"}`, timestamp: new Date().toISOString() });
      await db.update(interviewSessionsTable).set({ transcript, updatedAt: new Date() }).where(eq(interviewSessionsTable.id, sessionId)).catch(() => {});
      const errMsg = err instanceof Error ? err.message : "Stream error";
      res.write(`data: ${JSON.stringify({ type: "error", content: errMsg })}\n\n`);
    }

    res.end();
  } catch (err) {
    console.error("Interview message error:", err);
    if (!res.headersSent) {
      serverError(res);
    }
  }
});

router.post("/v1/interviews/:id/commit", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessionId = String(req.params.id);

    const [session] = await db.select().from(interviewSessionsTable)
      .where(and(
        eq(interviewSessionsTable.id, sessionId),
        eq(interviewSessionsTable.tenantId, tenantId),
      )).limit(1);

    if (!session) { notFound(res, "Interview session not found"); return; }
    if (session.status !== "active") { badRequest(res, "Interview session is not active"); return; }

    const draftData = session.draftData as Record<string, any>;
    if (!draftData || Object.keys(draftData).length === 0) {
      badRequest(res, "No draft data available. Continue the interview to generate a draft.");
      return;
    }

    let resultId: string | null = null;
    const { controlId } = req.body;

    if (session.type === "risk_creation") {
      const [risk] = await db.insert(risksTable).values({
        tenantId,
        title: draftData.title || "Untitled Risk",
        description: draftData.description || "",
        category: draftData.category || "operational",
        likelihood: draftData.likelihood || 1,
        impact: draftData.impact || 1,
        status: "draft",
      }).returning();
      resultId = risk.id;
    } else if (session.type === "control_assessment") {
      if (!controlId) {
        badRequest(res, "controlId is required to commit a control assessment");
        return;
      }
      const resultMap: Record<string, string> = { effective: "pass", partially_effective: "partial", ineffective: "fail" };
      const testResult = resultMap[draftData.result] || "not_tested";
      const notes = [
        draftData.notes || "",
        draftData.gaps?.length ? `\nGaps identified:\n${draftData.gaps.map((g: string) => `- ${g}`).join("\n")}` : "",
      ].join("").trim();

      const [controlTest] = await db.insert(controlTestsTable).values({
        tenantId,
        controlId,
        testerId: req.user!.id,
        result: testResult as any,
        notes,
        testedAt: new Date(),
      }).returning();
      resultId = controlTest.id;
    }

    await db.update(interviewSessionsTable).set({
      status: "committed",
      resultId,
      updatedAt: new Date(),
    }).where(eq(interviewSessionsTable.id, sessionId));

    await recordAudit(req, "interview_committed", "interview_session", sessionId, {
      type: session.type,
      resultId,
    });

    res.json({
      status: "committed",
      resultId,
      type: session.type,
    });
  } catch (err) {
    console.error("Commit interview error:", err);
    serverError(res);
  }
});

router.post("/v1/interviews/:id/abandon", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessionId = String(req.params.id);

    const [session] = await db.select().from(interviewSessionsTable)
      .where(and(
        eq(interviewSessionsTable.id, sessionId),
        eq(interviewSessionsTable.tenantId, tenantId),
      )).limit(1);

    if (!session) { notFound(res, "Interview session not found"); return; }
    if (session.status !== "active") { badRequest(res, "Interview session is not active"); return; }

    await db.update(interviewSessionsTable).set({
      status: "abandoned",
      updatedAt: new Date(),
    }).where(eq(interviewSessionsTable.id, sessionId));

    await recordAudit(req, "interview_abandoned", "interview_session", sessionId, { type: session.type });
    res.json({ status: "abandoned" });
  } catch (err) {
    console.error("Abandon interview error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/treatment-suggestions", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const riskId = String(req.params.riskId);

    const [risk] = await db.select().from(risksTable)
      .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)))
      .limit(1);

    if (!risk) { notFound(res, "Risk not found"); return; }

    const response = await complete(tenantId, {
      messages: [
        {
          role: "system",
          content: "You are a risk treatment advisor. Given a risk, suggest 3 treatment options with: type (mitigate/transfer/accept/avoid), description, estimated effort (low/medium/high), and expected residual risk reduction percentage. Respond in JSON: {\"treatments\":[{\"type\":\"...\",\"description\":\"...\",\"effort\":\"...\",\"riskReduction\":N}]}",
        },
        {
          role: "user",
          content: `Risk: ${risk.title}\nDescription: ${risk.description || "N/A"}\nCategory: ${risk.category}\nLikelihood: ${risk.likelihood}/5\nImpact: ${risk.impact}/5`,
        },
      ],
    });

    let treatments = [];
    try {
      const parsed = JSON.parse(response);
      treatments = parsed.treatments || [];
    } catch {
      treatments = [{ type: "mitigate", description: response, effort: "medium", riskReduction: 50 }];
    }

    await recordAudit(req, "treatment_suggestions", "risk", riskId, { count: treatments.length });
    res.json({ riskId, treatments });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      badRequest(res, err.message);
      return;
    }
    console.error("Treatment suggestions error:", err);
    const msg = err instanceof Error ? err.message : "AI service error";
    sendError(res, 502, "AI Service Error", msg);
  }
});

router.post("/v1/compliance/gap-remediation", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { frameworkId, gaps } = req.body;

    if (!gaps || !Array.isArray(gaps) || gaps.length === 0) {
      badRequest(res, "gaps array is required");
      return;
    }

    const response = await complete(tenantId, {
      messages: [
        {
          role: "system",
          content: "You are a compliance remediation advisor. Given compliance gaps, suggest remediation steps for each gap with: priority (critical/high/medium/low), remediation description, estimated effort in days, and suggested controls to implement. Respond in JSON: {\"remediations\":[{\"gap\":\"...\",\"priority\":\"...\",\"steps\":\"...\",\"effortDays\":N,\"suggestedControls\":[\"...\"]}]}",
        },
        {
          role: "user",
          content: `Framework: ${frameworkId || "General"}\nGaps:\n${gaps.map((g: string, i: number) => `${i + 1}. ${g}`).join("\n")}`,
        },
      ],
    });

    let remediations = [];
    try {
      const parsed = JSON.parse(response);
      remediations = parsed.remediations || [];
    } catch {
      remediations = [{ gap: gaps[0], priority: "medium", steps: response, effortDays: 30, suggestedControls: [] }];
    }

    await recordAudit(req, "gap_remediation", "compliance", frameworkId || "general", { gapCount: gaps.length });
    res.json({ frameworkId, remediations });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      badRequest(res, err.message);
      return;
    }
    console.error("Gap remediation error:", err);
    const msg = err instanceof Error ? err.message : "AI service error";
    sendError(res, 502, "AI Service Error", msg);
  }
});

export default router;
