import { db, signalsTable, risksTable, documentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { registerWorker, enqueueJob } from "./job-queue";
import { complete, isAvailable, LLMUnavailableError } from "./llm-service";

async function findSimilarRisks(embedding: number[], tenantId: string, threshold = 0.8) {
  if (!embedding.length) return [];

  const vectorStr = `[${embedding.join(",")}]`;
  const results = await db.select({
    id: risksTable.id,
    title: risksTable.title,
    similarity: sql<number>`1 - (${risksTable.embedding} <=> ${vectorStr}::vector)`,
  }).from(risksTable)
    .where(sql`${risksTable.tenantId} = ${tenantId} AND ${risksTable.embedding} IS NOT NULL AND 1 - (${risksTable.embedding} <=> ${vectorStr}::vector) >= ${threshold}`)
    .orderBy(sql`${risksTable.embedding} <=> ${vectorStr}::vector`)
    .limit(5);

  return results;
}

async function callLLM(tenantId: string, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>): Promise<string> {
  return complete(tenantId, { messages, temperature: 0.3, maxTokens: 1024 });
}

export function registerAIWorkers() {
  registerWorker("ai-triage", async (job) => {
    const { signalId } = job.payload as { signalId: string };

    const [signal] = await db.select().from(signalsTable)
      .where(eq(signalsTable.id, signalId)).limit(1);

    if (!signal) return { status: "not_found" };
    if (signal.status !== "pending") return { status: "already_processed" };

    const tenantId = signal.tenantId;
    const available = await isAvailable(tenantId);
    if (!available) {
      console.log(`[AI Triage] LLM unavailable for tenant, signal ${signalId} stays pending for manual triage`);
      return { status: "manual_fallback", reason: "No LLM provider configured" };
    }

    try {
      const response = await callLLM(tenantId, [
        {
          role: "system",
          content: "You are a risk management signal classifier. Given a signal, classify it into one of: cyber_threat, compliance_violation, vendor_risk, operational_risk, financial_risk, reputational_risk, other. Also provide a confidence score between 0.0 and 1.0. Respond in JSON: {\"classification\": \"...\", \"confidence\": 0.0}",
        },
        { role: "user", content: signal.content },
      ]);

      let classification = "other";
      let confidence = 0.5;

      try {
        const parsed = JSON.parse(response);
        classification = parsed.classification || "other";
        confidence = Number(parsed.confidence) || 0.5;
      } catch {
        console.warn(`[AI Triage] Failed to parse LLM response for signal ${signalId}`);
      }

      await db.update(signalsTable).set({
        status: "triaged",
        classification,
        confidence: String(confidence),
        updatedAt: new Date(),
      }).where(eq(signalsTable.id, signalId));

      let correlatedRisks: Array<{ id: string; title: string; similarity: number }> = [];
      if (confidence >= 0.7 && signal.embedding) {
        try {
          correlatedRisks = await findSimilarRisks(
            signal.embedding as unknown as number[],
            signal.tenantId,
            0.7
          );
          if (correlatedRisks.length > 0) {
            console.log(`[AI Triage] Signal ${signalId} correlated with ${correlatedRisks.length} risks`);
          }
        } catch (corrErr) {
          console.warn(`[AI Triage] pgvector correlation failed for signal ${signalId}:`, corrErr);
        }
      }

      return { status: "triaged", classification, confidence, correlatedRisks };
    } catch (err) {
      if (err instanceof LLMUnavailableError) {
        return { status: "manual_fallback", reason: err.message };
      }
      console.error(`[AI Triage] Error processing signal ${signalId}:`, err);
      return { status: "manual_fallback", reason: "AI classification failed" };
    }
  });

  registerWorker("ai-enrich", async (job) => {
    const { riskId } = job.payload as { riskId: string };

    const [risk] = await db.select().from(risksTable)
      .where(eq(risksTable.id, riskId)).limit(1);

    if (!risk) return { status: "not_found" };

    const tenantId = risk.tenantId;
    const available = await isAvailable(tenantId);
    if (!available) {
      return { status: "unavailable", reason: "No LLM provider configured" };
    }

    try {
      const response = await callLLM(tenantId, [
        {
          role: "system",
          content: "You are a risk management expert. Given a risk title and description, provide an enriched description with: 1) potential impact analysis, 2) suggested mitigation strategies, 3) related industry standards or frameworks. Keep it concise (max 500 words).",
        },
        { role: "user", content: `Title: ${risk.title}\nDescription: ${risk.description || "No description provided"}` },
      ]);

      await db.update(risksTable).set({
        description: `${risk.description || ""}\n\n---AI Enrichment---\n${response}`,
        updatedAt: new Date(),
      }).where(eq(risksTable.id, riskId));

      return { status: "enriched" };
    } catch (err) {
      console.error(`[AI Enrich] Error for risk ${riskId}:`, err);
      return { status: "failed", reason: String(err) };
    }
  });

  registerWorker("doc-process", async (job) => {
    const { documentId } = job.payload as { documentId: string };

    const [doc] = await db.select().from(documentsTable)
      .where(eq(documentsTable.id, documentId)).limit(1);

    if (!doc) return { status: "not_found" };

    await db.update(documentsTable).set({
      status: "processing",
      updatedAt: new Date(),
    }).where(eq(documentsTable.id, documentId));

    const tenantId = doc.tenantId;
    const available = await isAvailable(tenantId);
    if (!available) {
      await db.update(documentsTable).set({
        status: "uploaded",
        updatedAt: new Date(),
      }).where(eq(documentsTable.id, documentId));
      return { status: "unavailable", reason: "No LLM provider configured" };
    }

    try {
      const response = await callLLM(tenantId, [
        {
          role: "system",
          content: "You are a document analyst for vendor risk management. Summarize the key points, risks, and compliance-relevant information from this document metadata. Provide a structured summary.",
        },
        {
          role: "user",
          content: `Document: ${doc.fileName}\nType: ${doc.mimeType || "unknown"}\nVendor ID: ${doc.vendorId || "N/A"}`,
        },
      ]);

      await db.update(documentsTable).set({
        status: "processed",
        summary: response,
        updatedAt: new Date(),
      }).where(eq(documentsTable.id, documentId));

      return { status: "processed" };
    } catch (err) {
      await db.update(documentsTable).set({
        status: "failed",
        updatedAt: new Date(),
      }).where(eq(documentsTable.id, documentId));
      return { status: "failed", reason: String(err) };
    }
  });

  console.log("[AI Workers] Registered: ai-triage, ai-enrich, doc-process");
}
