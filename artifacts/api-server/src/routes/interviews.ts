import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, interviewSessionsTable, risksTable, controlTestsTable, controlsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, sendError } from "../lib/errors";
import { complete, streamComplete, isAvailable, LLMUnavailableError } from "../lib/llm-service";
import { enqueueJob } from "../lib/job-queue";

interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface RiskDraft {
  title?: string;
  description?: string;
  category?: string;
  likelihood?: number;
  impact?: number;
}

interface ControlAssessmentDraft {
  result?: string;
  notes?: string;
  gaps?: string[];
}

interface TreatmentSuggestion {
  type: string;
  description: string;
  effort: string;
  riskReduction: number;
}

interface RemediationStep {
  gap: string;
  priority: string;
  steps: string;
  effortDays: number;
  suggestedControls: string[];
}

const AI_UNAVAILABLE_MSG = "AI unavailable — manual mode active. Configure an LLM provider in Settings to enable AI features.";

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

router.post("/v1/ai/interview/start", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const { type } = req.body as { type?: string };

    if (!type || !["risk_creation", "control_assessment"].includes(type)) {
      badRequest(res, "type must be 'risk_creation' or 'control_assessment'");
      return;
    }

    const available = await isAvailable(tenantId);
    if (!available) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
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
      greeting = type === "risk_creation"
        ? '{"type":"question","content":"Let\'s begin. Can you describe the risk you\'d like to document?"}'
        : '{"type":"question","content":"Let\'s begin. Which control would you like to assess?"}';
    }

    const transcript: TranscriptEntry[] = [
      { role: "assistant", content: greeting, timestamp: new Date().toISOString() },
    ];

    const [session] = await db.insert(interviewSessionsTable).values({
      tenantId,
      userId,
      type: type as "risk_creation" | "control_assessment",
      transcript,
    }).returning();

    await recordAudit(req, "interview_started", "interview_session", session.id, { type });
    res.status(201).json(session);
  } catch (err) {
    console.error("Start interview error:", err);
    serverError(res);
  }
});

router.get("/v1/ai/interview/:sessionId", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [session] = await db.select().from(interviewSessionsTable)
      .where(and(
        eq(interviewSessionsTable.id, String(req.params.sessionId)),
        eq(interviewSessionsTable.tenantId, tenantId),
      )).limit(1);

    if (!session) { notFound(res, "Interview session not found"); return; }
    res.json(session);
  } catch (err) {
    console.error("Get interview error:", err);
    serverError(res);
  }
});

router.post("/v1/ai/interview/:sessionId/message", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessionId = String(req.params.sessionId);
    const { content } = req.body as { content?: string };

    if (!content) { badRequest(res, "content is required"); return; }

    const [session] = await db.select().from(interviewSessionsTable)
      .where(and(
        eq(interviewSessionsTable.id, sessionId),
        eq(interviewSessionsTable.tenantId, tenantId),
      )).limit(1);

    if (!session) { notFound(res, "Interview session not found"); return; }
    if (session.status !== "active") { badRequest(res, "Interview session is not active"); return; }

    const available = await isAvailable(tenantId);
    if (!available) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }

    const transcript = (session.transcript as TranscriptEntry[]) || [];
    transcript.push({ role: "user", content, timestamp: new Date().toISOString() });

    await db.update(interviewSessionsTable).set({
      transcript,
      updatedAt: new Date(),
    }).where(eq(interviewSessionsTable.id, sessionId));

    const systemPrompt = getSystemPrompt(session.type);
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...transcript.map((t) => ({ role: t.role, content: t.content })),
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

          let draftData = session.draftData as Record<string, unknown>;
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

router.post("/v1/ai/interview/:sessionId/commit", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessionId = String(req.params.sessionId);

    const [session] = await db.select().from(interviewSessionsTable)
      .where(and(
        eq(interviewSessionsTable.id, sessionId),
        eq(interviewSessionsTable.tenantId, tenantId),
      )).limit(1);

    if (!session) { notFound(res, "Interview session not found"); return; }
    if (session.status !== "active") { badRequest(res, "Interview session is not active"); return; }

    const draftData = session.draftData as Record<string, unknown>;
    if (!draftData || Object.keys(draftData).length === 0) {
      badRequest(res, "No draft data available. Continue the interview to generate a draft.");
      return;
    }

    let resultId: string | null = null;
    const { controlId } = req.body as { controlId?: string };

    if (session.type === "risk_creation") {
      const draft = draftData as unknown as RiskDraft;
      const [risk] = await db.insert(risksTable).values({
        tenantId,
        title: draft.title || "Untitled Risk",
        description: draft.description || "",
        category: (draft.category as "operational" | "financial" | "compliance" | "strategic" | "technology" | "reputational") || "operational",
        likelihood: draft.likelihood || 1,
        impact: draft.impact || 1,
        status: "draft",
      }).returning();
      resultId = risk.id;
    } else if (session.type === "control_assessment") {
      if (!controlId) {
        badRequest(res, "controlId is required to commit a control assessment");
        return;
      }

      const [control] = await db.select({ id: controlsTable.id }).from(controlsTable)
        .where(and(eq(controlsTable.id, controlId), eq(controlsTable.tenantId, tenantId)))
        .limit(1);
      if (!control) {
        notFound(res, "Control not found in your organization");
        return;
      }

      const draft = draftData as unknown as ControlAssessmentDraft;
      const resultMap: Record<string, "pass" | "partial" | "fail" | "not_tested"> = {
        effective: "pass",
        partially_effective: "partial",
        ineffective: "fail",
      };
      const testResult = resultMap[draft.result || ""] || "not_tested";
      const notes = [
        draft.notes || "",
        draft.gaps?.length ? `\nGaps identified:\n${draft.gaps.map((g) => `- ${g}`).join("\n")}` : "",
      ].join("").trim();

      const [controlTest] = await db.insert(controlTestsTable).values({
        tenantId,
        controlId,
        testerId: req.user!.id,
        result: testResult,
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

router.post("/v1/ai/interview/:sessionId/abandon", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessionId = String(req.params.sessionId);

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

router.post("/v1/risks/:id/ai/enrich", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const riskId = String(req.params.id);
    const tenantId = req.user!.tenantId;

    const available = await isAvailable(tenantId);
    if (!available) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }

    const [risk] = await db.select().from(risksTable)
      .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)))
      .limit(1);

    if (!risk) { notFound(res, "Risk not found"); return; }

    const job = await enqueueJob("ai-enrich", "enrich_risk", { riskId }, tenantId);
    await recordAudit(req, "enrich_request", "risk", riskId, { jobId: job.id });

    res.status(202).json({ jobId: job.id, status: "queued", message: "Risk enrichment job queued" });
  } catch (err) {
    console.error("Enrich risk error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:id/ai/suggest-treatments", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const riskId = String(req.params.id);

    const available = await isAvailable(tenantId);
    if (!available) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }

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

    let treatments: TreatmentSuggestion[] = [];
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
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }
    console.error("Treatment suggestions error:", err);
    const msg = err instanceof Error ? err.message : "AI service error";
    sendError(res, 502, "AI Service Error", msg);
  }
});

router.post("/v1/risks/:id/ai/score-suggestions", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const riskId = String(req.params.id);

    const available = await isAvailable(tenantId);
    if (!available) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }

    const [risk] = await db.select().from(risksTable)
      .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)))
      .limit(1);

    if (!risk) { notFound(res, "Risk not found"); return; }

    const historicalRisks = await db.select({
      title: risksTable.title,
      category: risksTable.category,
      likelihood: risksTable.likelihood,
      impact: risksTable.impact,
      residualLikelihood: risksTable.residualLikelihood,
      residualImpact: risksTable.residualImpact,
      targetLikelihood: risksTable.targetLikelihood,
      targetImpact: risksTable.targetImpact,
    }).from(risksTable)
      .where(and(
        eq(risksTable.tenantId, tenantId),
        eq(risksTable.category, risk.category),
      ))
      .limit(5);

    const historicalContext = historicalRisks
      .filter(r => r.title !== risk.title)
      .slice(0, 3)
      .map(r => `- "${r.title}" (${r.category}): Inherent L=${r.likelihood}/I=${r.impact}, Residual L=${r.residualLikelihood || "?"}/I=${r.residualImpact || "?"}, Target L=${r.targetLikelihood || "?"}/I=${r.targetImpact || "?"}`)
      .join("\n");

    const response = await complete(tenantId, {
      messages: [
        {
          role: "system",
          content: `You are a risk scoring expert. Given a risk, provide suggested scores for three risk assessment levels:
1. Inherent (raw risk before any controls)
2. Residual (current risk accounting for existing controls)
3. Target (goal risk after planned treatments)

Each score has likelihood (1-5) and impact (1-5). Also provide a confidence score (0-1) reflecting how certain you are, and a short rationale.

Respond in JSON only: {"inherent":{"likelihood":N,"impact":N},"residual":{"likelihood":N,"impact":N},"target":{"likelihood":N,"impact":N},"confidence":N,"rationale":"..."}`,
        },
        {
          role: "user",
          content: `Risk: ${risk.title}\nDescription: ${risk.description || "N/A"}\nCategory: ${risk.category}\nStatus: ${risk.status}\nCurrent Inherent: L=${risk.likelihood}/5, I=${risk.impact}/5\nCurrent Residual: L=${risk.residualLikelihood || "unset"}, I=${risk.residualImpact || "unset"}\nCurrent Target: L=${risk.targetLikelihood || "unset"}, I=${risk.targetImpact || "unset"}${historicalContext ? `\n\nHistorical scoring context from similar risks:\n${historicalContext}` : ""}`,
        },
      ],
    });

    let result: {
      inherent: { likelihood: number; impact: number };
      residual: { likelihood: number; impact: number };
      target: { likelihood: number; impact: number };
      confidence: number;
      rationale: string;
    };

    try {
      const parsed = JSON.parse(response);
      const extractScore = (obj: unknown, fallbackL: number, fallbackI: number) => {
        if (obj && typeof obj === "object" && "likelihood" in obj && "impact" in obj) {
          return { likelihood: Number((obj as Record<string, unknown>).likelihood) || fallbackL, impact: Number((obj as Record<string, unknown>).impact) || fallbackI };
        }
        return { likelihood: fallbackL, impact: fallbackI };
      };
      result = {
        inherent: extractScore(parsed.inherent, risk.likelihood, risk.impact),
        residual: extractScore(parsed.residual, risk.residualLikelihood || risk.likelihood, risk.residualImpact || risk.impact),
        target: extractScore(parsed.target, Math.max(1, risk.likelihood - 1), Math.max(1, risk.impact - 1)),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        rationale: typeof parsed.rationale === "string" ? parsed.rationale : "AI-generated suggestion",
      };
    } catch {
      result = {
        inherent: { likelihood: risk.likelihood, impact: risk.impact },
        residual: { likelihood: risk.residualLikelihood || risk.likelihood, impact: risk.residualImpact || risk.impact },
        target: { likelihood: Math.max(1, (risk.likelihood || 3) - 1), impact: Math.max(1, (risk.impact || 3) - 1) },
        confidence: 0.5,
        rationale: response,
      };
    }

    const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(v)));
    result.inherent.likelihood = clamp(result.inherent.likelihood);
    result.inherent.impact = clamp(result.inherent.impact);
    result.residual.likelihood = clamp(result.residual.likelihood);
    result.residual.impact = clamp(result.residual.impact);
    result.target.likelihood = clamp(result.target.likelihood);
    result.target.impact = clamp(result.target.impact);
    result.confidence = Math.max(0, Math.min(1, result.confidence));

    await recordAudit(req, "ai_score_suggestions", "risk", riskId, { confidence: result.confidence });
    res.json({ riskId, ...result });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }
    console.error("AI score suggestions error:", err);
    const msg = err instanceof Error ? err.message : "AI service error";
    sendError(res, 502, "AI Service Error", msg);
  }
});

router.post("/v1/compliance/:frameworkId/gap-analysis/ai-remediate", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworkId = String(req.params.frameworkId);
    const { gaps } = req.body as { gaps?: string[] };

    if (!gaps || !Array.isArray(gaps) || gaps.length === 0) {
      badRequest(res, "gaps array is required");
      return;
    }

    const available = await isAvailable(tenantId);
    if (!available) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
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
          content: `Framework: ${frameworkId}\nGaps:\n${gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}`,
        },
      ],
    });

    let remediations: RemediationStep[] = [];
    try {
      const parsed = JSON.parse(response);
      remediations = parsed.remediations || [];
    } catch {
      remediations = [{ gap: gaps[0], priority: "medium", steps: response, effortDays: 30, suggestedControls: [] }];
    }

    await recordAudit(req, "gap_remediation", "compliance", frameworkId, { gapCount: gaps.length });
    res.json({ frameworkId, remediations });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }
    console.error("Gap remediation error:", err);
    const msg = err instanceof Error ? err.message : "AI service error";
    sendError(res, 502, "AI Service Error", msg);
  }
});

export default router;
