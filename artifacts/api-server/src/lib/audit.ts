import { db, auditEventsTable } from "@workspace/db";

export async function recordAudit(
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
