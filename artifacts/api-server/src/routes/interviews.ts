import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, interviewSessionsTable, risksTable, controlTestsTable, controlsTable, signalsTable, findingsTable, agentFindingsTable } from "@workspace/db";
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

const RISK_SYSTEM_PROMPT = `You are a friendly risk management assistant helping users document enterprise risks through a short conversation. Ask at most 3 short, open-ended questions before proposing a draft — do not ask more questions than necessary.

Good seed questions (ask only what you still need):
- "What risk is on your mind?"
- "What's the likely consequence if it happens?"
- "How probable does it feel — rare, possible, or likely?"

Once you have a reasonable sense of the risk (title, consequence, and rough probability), synthesise a draft immediately. Do not keep asking questions once you have enough to make a sensible draft.

When ready to draft, respond ONLY with valid JSON:
{"type":"draft","data":{"title":"...","description":"...","category":"operational|financial|compliance|strategic|technology|reputational","likelihood":1-5,"impact":1-5}}

For all other turns respond ONLY with valid JSON:
{"type":"question","content":"your next question"}

Keep questions short and conversational. Never number them or list them all at once.`;

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
    const { controlId, saveAsDraft } = req.body as { controlId?: string; saveAsDraft?: boolean };

    if (session.type === "risk_creation") {
      const draft = draftData as unknown as RiskDraft;
      const riskStatus = saveAsDraft === false ? "open" : "draft";
      const [risk] = await db.insert(risksTable).values({
        tenantId,
        title: draft.title || "Untitled Risk",
        description: draft.description || "",
        category: (draft.category as "operational" | "financial" | "compliance" | "strategic" | "technology" | "reputational") || "operational",
        likelihood: draft.likelihood || 1,
        impact: draft.impact || 1,
        status: riskStatus,
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
          content: "You are a risk treatment advisor using the 4T framework (Treat, Transfer, Tolerate, Terminate). Given a risk, suggest 3 treatment options with: type (treat/transfer/tolerate/terminate), description, estimated effort (low/medium/high), and expected residual risk reduction percentage. Respond in JSON: {\"treatments\":[{\"type\":\"...\",\"description\":\"...\",\"effort\":\"...\",\"riskReduction\":N}]}",
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
      treatments = [{ type: "treat", description: response, effort: "medium", riskReduction: 50 }];
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

router.post("/v1/ai/risk-configurator", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { documentText } = req.body as { documentText?: string };

    const available = await isAvailable(tenantId);
    if (!available) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }

    const [recentSignals, recentFindings, recentAgentFindings] = await Promise.all([
      db.select({
        id: signalsTable.id,
        content: signalsTable.content,
        classification: signalsTable.classification,
        confidence: signalsTable.confidence,
      }).from(signalsTable)
        .where(eq(signalsTable.tenantId, tenantId))
        .orderBy(desc(signalsTable.createdAt))
        .limit(10),
      db.select({
        id: findingsTable.id,
        title: findingsTable.title,
        description: findingsTable.description,
      }).from(findingsTable)
        .where(eq(findingsTable.tenantId, tenantId))
        .orderBy(desc(findingsTable.createdAt))
        .limit(10),
      db.select({
        id: agentFindingsTable.id,
        title: agentFindingsTable.title,
        narrative: agentFindingsTable.narrative,
        severity: agentFindingsTable.severity,
        type: agentFindingsTable.type,
      }).from(agentFindingsTable)
        .where(eq(agentFindingsTable.tenantId, tenantId))
        .orderBy(desc(agentFindingsTable.createdAt))
        .limit(10),
    ]);

    const contextParts: string[] = [];

    if (recentSignals.length > 0) {
      contextParts.push(`## Recent Signals\n${recentSignals.map(s =>
        `- [Signal ${s.id?.slice(0, 8)}] ${s.content?.slice(0, 200)}${s.classification ? ` (class: ${s.classification})` : ""}`
      ).join("\n")}`);
    }

    if (recentFindings.length > 0) {
      contextParts.push(`## Recent Findings\n${recentFindings.map(f =>
        `- [Finding] ${f.title}: ${f.description?.slice(0, 150) || "No description"}`
      ).join("\n")}`);
    }

    if (recentAgentFindings.length > 0) {
      contextParts.push(`## Agent Detections\n${recentAgentFindings.map(a =>
        `- [${a.severity?.toUpperCase()} ${a.type}] ${a.title}: ${a.narrative?.slice(0, 150) || ""}`
      ).join("\n")}`);
    }

    if (documentText) {
      contextParts.push(`## Uploaded Document Content\n${documentText.slice(0, 3000)}`);
    }

    const context = contextParts.length > 0
      ? contextParts.join("\n\n")
      : "No signals, findings, or agent detections are currently available.";

    const systemPrompt = `You are an expert enterprise risk analyst. Based on the intelligence context provided, synthesise 2–5 compound risk scenarios that an organisation should be aware of. Each scenario should be grounded in the evidence provided.

For each scenario, provide:
- title: A clear, specific risk title (max 80 chars)
- description: 1-2 sentence description of the risk scenario and potential impact
- category: one of operational|financial|compliance|strategic|technology|reputational
- likelihood: integer 1–5 (1=rare, 5=almost certain)
- impact: integer 1–5 (1=negligible, 5=catastrophic)
- sources: array of 1–3 short strings describing the evidence (e.g. "CVE signal: SQL injection vulnerability", "Finding: unpatched systems")

Respond ONLY with valid JSON:
{"scenarios":[{"title":"...","description":"...","category":"...","likelihood":N,"impact":N,"sources":["..."]}]}

Rules:
- Only include risks clearly evidenced by the context
- Prefer compound scenarios that combine multiple signals where relevant
- Keep titles and descriptions concise and actionable
- If context is sparse, propose plausible general risks for the organisation type`;

    const response = await complete(tenantId, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyse the following intelligence context and propose risk scenarios:\n\n${context}` },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    interface RawScenario {
      title?: unknown;
      description?: unknown;
      category?: unknown;
      likelihood?: unknown;
      impact?: unknown;
      sources?: unknown;
    }

    let scenarios: Array<{
      title: string;
      description: string;
      category: string;
      likelihood: number;
      impact: number;
      sources: string[];
    }> = [];

    try {
      const cleaned = response.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      const validCategories = ["operational", "financial", "compliance", "strategic", "technology", "reputational"];
      scenarios = Array.isArray(parsed.scenarios)
        ? (parsed.scenarios as RawScenario[]).map((s) => ({
            title: String(s.title || "Untitled Risk"),
            description: String(s.description || ""),
            category: validCategories.includes(String(s.category)) ? String(s.category) : "operational",
            likelihood: Math.max(1, Math.min(5, Number(s.likelihood) || 3)),
            impact: Math.max(1, Math.min(5, Number(s.impact) || 3)),
            sources: Array.isArray(s.sources) ? (s.sources as unknown[]).map(String) : [],
          })).filter(s => s.title && s.title !== "Untitled Risk")
        : [];
    } catch {
      scenarios = [];
    }

    await recordAudit(req, "risk_configurator", "signal", undefined, {
      scenarioCount: scenarios.length,
      hadDocument: !!documentText,
    });

    res.json({ scenarios });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      sendError(res, 422, "AI Unavailable", AI_UNAVAILABLE_MSG);
      return;
    }
    console.error("Risk configurator error:", err);
    serverError(res);
  }
});

router.post("/v1/ai/risk-configurator/save", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { title, description, category, likelihood, impact, saveAsDraft } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      likelihood?: number;
      impact?: number;
      saveAsDraft?: boolean;
    };

    if (!title) { badRequest(res, "title is required"); return; }

    const validCategories = ["operational", "financial", "compliance", "strategic", "technology", "reputational"];
    const riskStatus = saveAsDraft !== false ? "draft" : "open";

    const [risk] = await db.insert(risksTable).values({
      tenantId,
      title: title.slice(0, 200),
      description: description || "",
      category: (validCategories.includes(category || "") ? category : "operational") as "operational" | "financial" | "compliance" | "strategic" | "technology" | "reputational",
      likelihood: Math.max(1, Math.min(5, likelihood || 3)),
      impact: Math.max(1, Math.min(5, impact || 3)),
      status: riskStatus,
    }).returning();

    await recordAudit(req, "create", "risk", risk.id, { fromRiskConfigurator: true, saveAsDraft: riskStatus === "draft" });

    res.status(201).json({ risk });
  } catch (err) {
    console.error("Risk configurator save error:", err);
    serverError(res);
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
