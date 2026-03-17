import { db, signalsTable, findingsTable, agentFindingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { complete, isAvailable } from "../lib/llm-service";

interface RelatedSignalRow {
  id: string;
  content: string;
  source: string;
  similarity: number;
}

export interface FindingCluster {
  signalIds: string[];
  suggestedTitle: string;
  suggestedDescription: string;
}

export class RiskSourceAggregator {
  constructor(private tenantId: string) {}

  async triageSignal(signalId: string): Promise<{
    finding: typeof findingsTable.$inferSelect;
    signal: typeof signalsTable.$inferSelect;
    clusteredSignalIds: string[];
  }> {
    const result = await db.transaction(async (tx) => {
      const signalRows = await tx.execute(
        sql`SELECT * FROM signals WHERE id = ${signalId} AND tenant_id = ${this.tenantId} LIMIT 1 FOR UPDATE`,
      );
      const signal = signalRows.rows[0] as Record<string, unknown> | undefined;

      if (!signal) throw new Error("Signal not found");
      const signalStatus = String(signal.status);
      if (signalStatus !== "pending" && signalStatus !== "triaged") {
        throw new Error(
          `Signal is '${signalStatus}', expected 'pending' or 'triaged'. Only pending/triaged signals can be triaged into findings.`,
        );
      }

      const [existingFinding] = await tx
        .select()
        .from(findingsTable)
        .where(
          and(
            eq(findingsTable.signalId, signalId),
            eq(findingsTable.tenantId, this.tenantId),
          ),
        )
        .limit(1);

      if (existingFinding) {
        const [currentSignal] = await tx
          .update(signalsTable)
          .set({ status: "finding" as const, updatedAt: new Date() })
          .where(eq(signalsTable.id, signalId))
          .returning();
        return { finding: existingFinding, signal: currentSignal, clusteredSignalIds: [] };
      }

      if (signalStatus === "pending") {
        const [condUpdate] = await tx
          .update(signalsTable)
          .set({ status: "triaged" as const, updatedAt: new Date() })
          .where(
            and(
              eq(signalsTable.id, signalId),
              eq(signalsTable.status, "pending"),
            ),
          )
          .returning();

        if (!condUpdate) {
          throw new Error("Signal status changed concurrently. Please retry.");
        }
      }

      const signalEmbedding = signal.embedding as unknown as number[] | null;
      const signalContent = String(signal.content || "");
      const signalSource = String(signal.source || "");
      const signalClassification = String(signal.classification || "unknown");

      const clusteredSignalIds: string[] = [];
      if (signalEmbedding) {
        const related = await this.findRelatedPendingSignals(signalId, signalEmbedding);
        for (const rel of related) {
          const [updated] = await tx
            .update(signalsTable)
            .set({ status: "triaged" as const, updatedAt: new Date() })
            .where(
              and(
                eq(signalsTable.id, rel.id),
                eq(signalsTable.status, "pending"),
              ),
            )
            .returning();
          if (updated) {
            clusteredSignalIds.push(rel.id);
          }
        }
      }

      let findingTitle = `Finding from signal: ${signalContent.substring(0, 100)}`;
      let findingDescription = signalContent;

      if (clusteredSignalIds.length > 0) {
        findingTitle = `Cluster of ${clusteredSignalIds.length + 1} related signals from ${signalSource}`;
        findingDescription = `Primary signal: ${signalContent}\n\nCorrelated with ${clusteredSignalIds.length} semantically similar signal(s).`;
      }

      const llmReady = await isAvailable(this.tenantId);
      if (llmReady) {
        try {
          const raw = await complete(this.tenantId, {
            messages: [
              {
                role: "system",
                content:
                  "You are a risk analyst. Given a signal (and optional related signals), produce a concise finding title and description. Respond ONLY with JSON: {\"title\": \"...\", \"description\": \"...\"}",
              },
              {
                role: "user",
                content: `Signal source: ${signalSource}\nSignal content: ${signalContent}\nClassification: ${signalClassification}\nRelated signals count: ${clusteredSignalIds.length}`,
              },
            ],
            temperature: 0.3,
            maxTokens: 300,
          });
          const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
          if (parsed.title) findingTitle = parsed.title;
          if (parsed.description) findingDescription = parsed.description;
        } catch {
          // fall back to defaults
        }
      }

      const [finding] = await tx
        .insert(findingsTable)
        .values({
          tenantId: this.tenantId,
          signalId,
          title: findingTitle,
          description: findingDescription,
        })
        .returning();

      const [updatedPrimary] = await tx
        .update(signalsTable)
        .set({ status: "finding" as const, updatedAt: new Date() })
        .where(eq(signalsTable.id, signalId))
        .returning();

      for (const clusteredId of clusteredSignalIds) {
        await tx.insert(findingsTable).values({
          tenantId: this.tenantId,
          signalId: clusteredId,
          title: `Related to: ${findingTitle}`,
          description: `Clustered with primary signal finding. ${findingDescription}`,
        });

        await tx
          .update(signalsTable)
          .set({ status: "finding" as const, updatedAt: new Date() })
          .where(eq(signalsTable.id, clusteredId));
      }

      return { finding, signal: updatedPrimary, clusteredSignalIds };
    });

    return result;
  }

  private async findRelatedPendingSignals(
    signalId: string,
    embedding: number[],
  ): Promise<RelatedSignalRow[]> {
    const vectorStr = `[${embedding.join(",")}]`;
    const results = await db.execute(
      sql`SELECT id, content, source, 1 - (embedding <=> ${vectorStr}::vector) as similarity
          FROM signals
          WHERE tenant_id = ${this.tenantId}
            AND id != ${signalId}
            AND status = 'pending'
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vectorStr}::vector) > 0.8
          ORDER BY similarity DESC
          LIMIT 10`,
    );

    if (!results.rows || results.rows.length === 0) return [];

    return results.rows.map((r) => ({
      id: String((r as Record<string, unknown>).id),
      content: String((r as Record<string, unknown>).content),
      source: String((r as Record<string, unknown>).source),
      similarity: Number((r as Record<string, unknown>).similarity),
    }));
  }

  async findRelatedSignals(signalId: string): Promise<FindingCluster[]> {
    const [signal] = await db
      .select()
      .from(signalsTable)
      .where(
        and(
          eq(signalsTable.id, signalId),
          eq(signalsTable.tenantId, this.tenantId),
        ),
      )
      .limit(1);

    if (!signal || !signal.embedding) return [];

    const related = await this.findRelatedPendingSignals(
      signalId,
      signal.embedding as unknown as number[],
    );

    if (related.length === 0) return [];

    const clusterSignalIds = [signalId, ...related.map((r) => r.id)];

    return [
      {
        signalIds: clusterSignalIds,
        suggestedTitle: `Cluster of ${clusterSignalIds.length} related signals`,
        suggestedDescription: `Related signals detected by embedding similarity from source: ${signal.source}`,
      },
    ];
  }

  async aggregateRiskSources(): Promise<{
    signals: Array<{ id: string; content: string; source: string; status: string }>;
    findings: Array<{ id: string; title: string; status: string; signalId: string | null }>;
    agentDetections: Array<{ id: string; title: string; type: string; severity: string; status: string }>;
  }> {
    const [signals, findings, agentDetections] = await Promise.all([
      db
        .select({
          id: signalsTable.id,
          content: signalsTable.content,
          source: signalsTable.source,
          status: signalsTable.status,
        })
        .from(signalsTable)
        .where(
          and(
            eq(signalsTable.tenantId, this.tenantId),
            sql`${signalsTable.status} IN ('triaged', 'finding')`,
          ),
        )
        .limit(100),
      db
        .select({
          id: findingsTable.id,
          title: findingsTable.title,
          status: findingsTable.status,
          signalId: findingsTable.signalId,
        })
        .from(findingsTable)
        .where(
          and(
            eq(findingsTable.tenantId, this.tenantId),
            sql`${findingsTable.riskId} IS NULL`,
          ),
        )
        .limit(100),
      db
        .select({
          id: agentFindingsTable.id,
          title: agentFindingsTable.title,
          type: agentFindingsTable.type,
          severity: agentFindingsTable.severity,
          status: agentFindingsTable.status,
        })
        .from(agentFindingsTable)
        .where(
          and(
            eq(agentFindingsTable.tenantId, this.tenantId),
            eq(agentFindingsTable.status, "pending_review"),
          ),
        )
        .limit(100),
    ]);

    return { signals, findings, agentDetections };
  }
}
