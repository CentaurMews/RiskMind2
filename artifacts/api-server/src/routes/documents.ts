import { Router, type Request, type Response } from "express";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import { requireRole } from "../middlewares/rbac";
import { badRequest, serverError, sendError } from "../lib/errors";
import { complete, isAvailable, LLMUnavailableError } from "../lib/llm-service";
import { parseDocument } from "../services/document-parser";
import { db, signalsTable, risksTable } from "@workspace/db";
import { recordAudit } from "../lib/audit";
import { enqueueJob } from "../lib/job-queue";

const router = Router();

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "docx", "xlsx", "pptx",
  "txt", "md", "markdown", "csv",
]);

const GENERIC_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/binary",
]);

function isAllowed(mimetype: string, originalname: string): boolean {
  const ext = originalname.split(".").pop()?.toLowerCase() ?? "";
  if (GENERIC_MIME_TYPES.has(mimetype)) {
    return ALLOWED_EXTENSIONS.has(ext);
  }
  return ALLOWED_MIME_TYPES.has(mimetype) && ALLOWED_EXTENSIONS.has(ext);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (isAllowed(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

export interface ProposedRisk {
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  rationale: string;
}

export interface AdjustmentSuggestion {
  riskId: string | null;
  riskTitle: string;
  field: string;
  suggestedValue: string | number;
  rationale: string;
}

export interface ExtractedSignal {
  title: string;
  description: string;
}

export interface DocumentAnalysisResult {
  documentName: string;
  documentSignalId: string | null;
  summary: string;
  proposedRisks: ProposedRisk[];
  adjustmentSuggestions: AdjustmentSuggestion[];
  extractedSignals: ExtractedSignal[];
}

function buildSystemPrompt(existingRisks: Array<{ id: string; title: string; category: string; likelihood: number; impact: number }>): string {
  const riskContext = existingRisks.length > 0
    ? `\n\nExisting risks in the register (use these for adjustment suggestions when relevant):\n${existingRisks.map(r => `- ID:${r.id} | "${r.title}" (${r.category}, L${r.likelihood}/I${r.impact})`).join("\n")}`
    : "";

  return `You are an expert enterprise risk analyst. Your task is to analyse document content and extract risk-relevant information.

Given the document text, produce a JSON response with these fields:

{
  "summary": "2-3 sentence overview of what the document is about",
  "proposedRisks": [
    {
      "title": "Clear risk title",
      "description": "Description of the risk scenario and potential impact",
      "category": "one of: operational|financial|compliance|strategic|technology|reputational",
      "likelihood": <1-5 integer>,
      "impact": <1-5 integer>,
      "rationale": "Why this document suggests this risk"
    }
  ],
  "adjustmentSuggestions": [
    {
      "riskId": "<exact risk ID from the register list, or null if not matched>",
      "riskTitle": "Title of the matching existing risk",
      "field": "e.g. likelihood or impact or description",
      "suggestedValue": "new value or descriptive suggestion",
      "rationale": "Why the document evidence supports this change"
    }
  ],
  "extractedSignals": [
    {
      "title": "Brief signal title",
      "description": "Description of the signal or notable finding worth monitoring"
    }
  ]
}${riskContext}

Rules:
- Only propose risks that are clearly evidenced by the document content
- Keep proposedRisks to the most significant 3-5 findings
- For adjustmentSuggestions, only include existing risks from the register list above. Set riskId to the exact ID from the list.
- Keep adjustmentSuggestions sparse — only include if there is clear evidence from the document
- Keep extractedSignals to 3-7 noteworthy items
- All arrays may be empty if nothing relevant is found
- Respond ONLY with valid JSON, no markdown fences`;
}

router.post(
  "/v1/documents/analyze-for-risk",
  requireRole("admin", "risk_manager"),
  (req: Request, res: Response, next) => {
    upload.array("files", 5)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          badRequest(res, "File too large. Maximum size is 20 MB per file.");
        } else {
          badRequest(res, `Upload error: ${err.message}`);
        }
        return;
      }
      if (err) {
        badRequest(res, err.message);
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        badRequest(res, "At least one file is required");
        return;
      }

      const available = await isAvailable(tenantId);
      if (!available) {
        sendError(res, 422, "AI Unavailable", "AI unavailable — configure an LLM provider in Settings to enable document analysis.");
        return;
      }

      const existingRisks = await db.select({
        id: risksTable.id,
        title: risksTable.title,
        category: risksTable.category,
        likelihood: risksTable.likelihood,
        impact: risksTable.impact,
      }).from(risksTable)
        .where(and(eq(risksTable.tenantId, tenantId)))
        .limit(20);

      const systemPrompt = buildSystemPrompt(existingRisks);
      const validRiskIds = new Set(existingRisks.map(r => r.id));

      const results: DocumentAnalysisResult[] = [];

      for (const file of files) {
        let parsed;
        try {
          parsed = await parseDocument(file.buffer, file.originalname, file.mimetype);
        } catch (parseErr) {
          const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          results.push({
            documentName: file.originalname,
            documentSignalId: null,
            summary: `Could not parse document: ${msg}`,
            proposedRisks: [],
            adjustmentSuggestions: [],
            extractedSignals: [],
          });
          continue;
        }

        const MAX_TEXT_LENGTH = 12000;
        const truncatedText = parsed.text.length > MAX_TEXT_LENGTH
          ? parsed.text.slice(0, MAX_TEXT_LENGTH) + "\n\n[... content truncated for analysis ...]"
          : parsed.text;

        if (!truncatedText.trim()) {
          results.push({
            documentName: file.originalname,
            documentSignalId: null,
            summary: "Document appears to be empty or contains no extractable text.",
            proposedRisks: [],
            adjustmentSuggestions: [],
            extractedSignals: [],
          });
          continue;
        }

        let analysisResult: DocumentAnalysisResult;
        try {
          const response = await complete(tenantId, {
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Document: ${parsed.name}\nType: ${parsed.mimeType}\nWord count: ${parsed.wordCount}${parsed.pageCount ? `\nPages: ${parsed.pageCount}` : ""}\n\n---\n\n${truncatedText}`,
              },
            ],
            temperature: 0.2,
            maxTokens: 2048,
          });

          let parsed_response: {
            summary?: string;
            proposedRisks?: unknown[];
            adjustmentSuggestions?: unknown[];
            extractedSignals?: unknown[];
          };
          try {
            parsed_response = JSON.parse(response);
          } catch {
            parsed_response = {};
          }

          const validCategories = ["operational", "financial", "compliance", "strategic", "technology", "reputational"];

          const proposedRisks: ProposedRisk[] = Array.isArray(parsed_response.proposedRisks)
            ? (parsed_response.proposedRisks as ProposedRisk[]).map((r) => ({
                title: String(r.title || ""),
                description: String(r.description || ""),
                category: validCategories.includes(String(r.category)) ? String(r.category) : "operational",
                likelihood: Math.max(1, Math.min(5, Number(r.likelihood) || 3)),
                impact: Math.max(1, Math.min(5, Number(r.impact) || 3)),
                rationale: String(r.rationale || ""),
              })).filter((r) => r.title)
            : [];

          const adjustmentSuggestions: AdjustmentSuggestion[] = Array.isArray(parsed_response.adjustmentSuggestions)
            ? (parsed_response.adjustmentSuggestions as AdjustmentSuggestion[]).map((s) => ({
                riskId: (s.riskId && validRiskIds.has(String(s.riskId))) ? String(s.riskId) : null,
                riskTitle: String(s.riskTitle || ""),
                field: String(s.field || ""),
                suggestedValue: s.suggestedValue,
                rationale: String(s.rationale || ""),
              })).filter((s) => s.riskTitle)
            : [];

          const extractedSignals: ExtractedSignal[] = Array.isArray(parsed_response.extractedSignals)
            ? (parsed_response.extractedSignals as ExtractedSignal[]).map((s) => ({
                title: String(s.title || ""),
                description: String(s.description || ""),
              })).filter((s) => s.title)
            : [];

          const summary = String(parsed_response.summary || "Analysis complete.");

          let documentSignalId: string | null = null;
          try {
            const [docSignal] = await db.insert(signalsTable).values({
              tenantId,
              source: "document_analysis",
              content: `[Document: ${parsed.name}]\n\n${summary}\n\nProposed risks: ${proposedRisks.map(r => r.title).join(", ") || "none"}`,
            }).returning({ id: signalsTable.id });
            documentSignalId = docSignal.id;
            await enqueueJob("ai-triage", "classify", { signalId: docSignal.id }, tenantId);
          } catch (signalErr) {
            console.warn("[Document Analysis] Failed to create tracking signal:", signalErr);
          }

          analysisResult = {
            documentName: parsed.name,
            documentSignalId,
            summary,
            proposedRisks,
            adjustmentSuggestions,
            extractedSignals,
          };
        } catch (llmErr) {
          if (llmErr instanceof LLMUnavailableError) {
            sendError(res, 422, "AI Unavailable", llmErr.message);
            return;
          }
          console.error("[Document Analysis] LLM error:", llmErr);
          analysisResult = {
            documentName: parsed.name,
            documentSignalId: null,
            summary: "AI analysis failed for this document.",
            proposedRisks: [],
            adjustmentSuggestions: [],
            extractedSignals: [],
          };
        }

        results.push(analysisResult);
      }

      await recordAudit(req, "document_analysis", "signal", undefined, {
        fileCount: files.length,
        fileNames: files.map(f => f.originalname),
      });

      res.json({ results });
    } catch (err) {
      console.error("[Document Analysis] Error:", err);
      serverError(res);
    }
  }
);

router.post(
  "/v1/documents/save-signal",
  requireRole("admin", "risk_manager", "auditor"),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { title, description, documentName } = req.body as {
        title?: string;
        description?: string;
        documentName?: string;
      };

      if (!title) {
        badRequest(res, "title is required");
        return;
      }

      const content = description
        ? `${title}\n\n${description}${documentName ? `\n\nSource document: ${documentName}` : ""}`
        : `${title}${documentName ? `\n\nSource document: ${documentName}` : ""}`;

      const [signal] = await db.insert(signalsTable).values({
        tenantId,
        source: documentName ? `document:${documentName.slice(0, 200)}` : "document_analysis",
        content,
      }).returning();

      await enqueueJob("ai-triage", "classify", { signalId: signal.id }, tenantId);
      await recordAudit(req, "create", "signal", signal.id, { fromDocumentAnalysis: true });

      res.status(201).json({ signal });
    } catch (err) {
      console.error("[Save Signal] Error:", err);
      serverError(res);
    }
  }
);

export default router;
