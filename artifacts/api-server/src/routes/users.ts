import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";

const router = Router();

const VALID_ROLES = ["admin", "risk_manager", "risk_owner", "auditor", "viewer", "vendor"] as const;

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  const { hashedPassword, ...rest } = user;
  return rest;
}

router.get("/v1/users", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const users = await db.select().from(usersTable)
      .where(eq(usersTable.tenantId, tenantId));
    res.json(users.map(sanitizeUser));
  } catch (err) {
    console.error("List users error:", err);
    serverError(res);
  }
});

router.put("/v1/users/:id/role", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = String(req.params.id);
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      badRequest(res, `role must be one of: ${VALID_ROLES.join(", ")}`);
      return;
    }

    const [existing] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { notFound(res, "User not found"); return; }

    if (existing.id === req.user!.id) {
      badRequest(res, "Cannot change your own role");
      return;
    }

    const [updated] = await db.update(usersTable)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
      .returning();

    await recordAudit(req, "user_role_updated", "user", userId, { oldRole: existing.role, newRole: role });
    res.json(sanitizeUser(updated));
  } catch (err) {
    console.error("Update user role error:", err);
    serverError(res);
  }
});

export default router;
