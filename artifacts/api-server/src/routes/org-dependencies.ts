import { Router } from "express";
import { eq, and, sql, count } from "drizzle-orm";
import {
  db,
  orgDependenciesTable,
  vendorsTable,
  signalsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";

const VALID_CATEGORIES = ["email", "cloud", "cdn", "identity", "payment", "communication", "other"] as const;
type OrgDependencyCategory = typeof VALID_CATEGORIES[number];

function isValidCategory(c: string): c is OrgDependencyCategory {
  return VALID_CATEGORIES.includes(c as OrgDependencyCategory);
}

const router = Router();

/**
 * GET /v1/org-dependencies/concentration-risk — Vendors appearing in multiple dependency categories (VNDR-07)
 * NOTE: This route must come BEFORE /:id to avoid path conflict
 */
router.get("/v1/org-dependencies/concentration-risk", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const results = await db
      .select({
        vendorId: orgDependenciesTable.vendorId,
        vendorName: vendorsTable.name,
        dependencyCount: count(orgDependenciesTable.id),
        categories: sql<string[]>`array_agg(DISTINCT ${orgDependenciesTable.category})`,
        openSignalCount: sql<number>`COALESCE((
          SELECT count(*)::int
          FROM signals
          WHERE signals.vendor_id = ${orgDependenciesTable.vendorId}
            AND signals.tenant_id = ${tenantId}
            AND signals.status != 'dismissed'
            AND signals.created_at > now() - interval '30 days'
        ), 0)`,
      })
      .from(orgDependenciesTable)
      .innerJoin(vendorsTable, eq(orgDependenciesTable.vendorId, vendorsTable.id))
      .where(and(
        eq(orgDependenciesTable.tenantId, tenantId),
        sql`${orgDependenciesTable.vendorId} IS NOT NULL`,
      ))
      .groupBy(orgDependenciesTable.vendorId, vendorsTable.name)
      .having(sql`count(${orgDependenciesTable.id}) > 1`);

    res.json(results);
  } catch (err) {
    console.error("Concentration risk error:", err);
    serverError(res);
  }
});

/**
 * GET /v1/org-dependencies — List all org dependencies for tenant
 */
router.get("/v1/org-dependencies", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const results = await db
      .select({
        id: orgDependenciesTable.id,
        tenantId: orgDependenciesTable.tenantId,
        category: orgDependenciesTable.category,
        providerName: orgDependenciesTable.providerName,
        vendorId: orgDependenciesTable.vendorId,
        vendorName: vendorsTable.name,
        criticality: orgDependenciesTable.criticality,
        notes: orgDependenciesTable.notes,
        createdAt: orgDependenciesTable.createdAt,
        updatedAt: orgDependenciesTable.updatedAt,
      })
      .from(orgDependenciesTable)
      .leftJoin(vendorsTable, eq(orgDependenciesTable.vendorId, vendorsTable.id))
      .where(eq(orgDependenciesTable.tenantId, tenantId))
      .orderBy(orgDependenciesTable.createdAt);

    res.json({ data: results });
  } catch (err) {
    console.error("List org dependencies error:", err);
    serverError(res);
  }
});

/**
 * POST /v1/org-dependencies — Create a dependency
 */
router.post("/v1/org-dependencies", requireRole("admin"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { category, providerName, vendorId, criticality, notes } = req.body;

    if (!category || !isValidCategory(category)) {
      badRequest(res, `category must be one of: ${VALID_CATEGORIES.join(", ")}`);
      return;
    }
    if (!providerName || typeof providerName !== "string" || providerName.trim().length === 0) {
      badRequest(res, "providerName is required");
      return;
    }

    const [dep] = await db.insert(orgDependenciesTable).values({
      tenantId,
      category,
      providerName: providerName.trim(),
      vendorId: vendorId ?? null,
      criticality: criticality ?? null,
      notes: notes ?? null,
    }).returning();

    await recordAudit(req, "create_org_dependency", "org_dependency", dep.id);
    res.status(201).json(dep);
  } catch (err) {
    console.error("Create org dependency error:", err);
    serverError(res);
  }
});

/**
 * PUT /v1/org-dependencies/:id — Update a dependency (category is immutable)
 */
router.put("/v1/org-dependencies/:id", requireRole("admin"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);
    const { providerName, vendorId, criticality, notes } = req.body;

    const [existing] = await db.select({ id: orgDependenciesTable.id })
      .from(orgDependenciesTable)
      .where(and(eq(orgDependenciesTable.id, id), eq(orgDependenciesTable.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      notFound(res, "Org dependency not found");
      return;
    }

    const [updated] = await db.update(orgDependenciesTable)
      .set({
        ...(providerName !== undefined && { providerName: String(providerName).trim() }),
        ...(vendorId !== undefined && { vendorId: vendorId ?? null }),
        ...(criticality !== undefined && { criticality: criticality ?? null }),
        ...(notes !== undefined && { notes: notes ?? null }),
        updatedAt: new Date(),
      })
      .where(and(eq(orgDependenciesTable.id, id), eq(orgDependenciesTable.tenantId, tenantId)))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("Update org dependency error:", err);
    serverError(res);
  }
});

/**
 * DELETE /v1/org-dependencies/:id — Delete a dependency
 */
router.delete("/v1/org-dependencies/:id", requireRole("admin"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const deleted = await db.delete(orgDependenciesTable)
      .where(and(eq(orgDependenciesTable.id, id), eq(orgDependenciesTable.tenantId, tenantId)))
      .returning({ id: orgDependenciesTable.id });

    if (deleted.length === 0) {
      notFound(res, "Org dependency not found");
      return;
    }

    res.status(204).send();
  } catch (err) {
    console.error("Delete org dependency error:", err);
    serverError(res);
  }
});

export default router;
