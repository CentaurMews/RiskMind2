import type { Request } from "express";
import { db, auditEventsTable } from "@workspace/db";

export async function recordAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  payload?: Record<string, unknown>
) {
  if (!req.user) return;
  await db.insert(auditEventsTable).values({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    action,
    entityType,
    entityId,
    payload: payload || {},
  });
}

export async function recordAuditDirect(
  tenantId: string,
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  payload?: Record<string, unknown>
) {
  await db.insert(auditEventsTable).values({
    tenantId,
    userId,
    action,
    entityType,
    entityId,
    payload: payload || {},
  });
}
