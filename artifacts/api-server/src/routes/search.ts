import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { generateEmbedding, LLMUnavailableError } from "../lib/llm-service";
import { serverError, badRequest } from "../lib/errors";

const router = Router();

router.post("/v1/search", async (req, res) => {
  try {
    const { query, types = ["risk", "vendor", "signal"] } = req.body;
    const tenantId = req.user!.tenantId;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return badRequest(res, "query is required");
    }

    const q = query.trim();
    let useEmbedding = true;
    let embedding: number[] = [];

    try {
      embedding = await generateEmbedding(tenantId, q);
    } catch (err) {
      if (err instanceof LLMUnavailableError) {
        useEmbedding = false;
      } else {
        throw err;
      }
    }

    const LIMIT = 5;
    const THRESHOLD = 0.4;
    const results: Record<string, unknown[]> = {};

    if (types.includes("risk")) {
      if (useEmbedding) {
        const vectorStr = `[${embedding.join(",")}]`;
        const rows = await db.execute(sql`
          SELECT id, title, category, status,
                 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM risks
          WHERE tenant_id = ${tenantId}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vectorStr}::vector) > ${THRESHOLD}
          ORDER BY similarity DESC
          LIMIT ${LIMIT}
        `);
        results.risks = rows.rows as unknown[];
      } else {
        const rows = await db.execute(sql`
          SELECT id, title, category, status
          FROM risks
          WHERE tenant_id = ${tenantId}
            AND title ILIKE ${'%' + q + '%'}
          LIMIT ${LIMIT}
        `);
        results.risks = rows.rows as unknown[];
      }
    }

    if (types.includes("vendor")) {
      if (useEmbedding) {
        const vectorStr = `[${embedding.join(",")}]`;
        const rows = await db.execute(sql`
          SELECT id, name, category, vendor_status AS status,
                 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM vendors
          WHERE tenant_id = ${tenantId}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vectorStr}::vector) > ${THRESHOLD}
          ORDER BY similarity DESC
          LIMIT ${LIMIT}
        `);
        results.vendors = rows.rows as unknown[];
      } else {
        const rows = await db.execute(sql`
          SELECT id, name, category, vendor_status AS status
          FROM vendors
          WHERE tenant_id = ${tenantId}
            AND name ILIKE ${'%' + q + '%'}
          LIMIT ${LIMIT}
        `);
        results.vendors = rows.rows as unknown[];
      }
    }

    if (types.includes("signal")) {
      if (useEmbedding) {
        const vectorStr = `[${embedding.join(",")}]`;
        const rows = await db.execute(sql`
          SELECT id, content, classification, confidence,
                 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM signals
          WHERE tenant_id = ${tenantId}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vectorStr}::vector) > ${THRESHOLD}
          ORDER BY similarity DESC
          LIMIT ${LIMIT}
        `);
        results.signals = rows.rows as unknown[];
      } else {
        const rows = await db.execute(sql`
          SELECT id, content, classification, confidence
          FROM signals
          WHERE tenant_id = ${tenantId}
            AND content ILIKE ${'%' + q + '%'}
          LIMIT ${LIMIT}
        `);
        results.signals = rows.rows as unknown[];
      }
    }

    res.json({ results, usedEmbedding: useEmbedding });
  } catch (err) {
    console.error("Search error:", err);
    serverError(res);
  }
});

export default router;
