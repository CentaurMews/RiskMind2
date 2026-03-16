import { eq, and, sql, gt, inArray, ilike, type SQL } from "drizzle-orm";
import {
  db,
  risksTable,
  krisTable,
  vendorsTable,
  signalsTable,
  alertsTable,
  controlsTable,
  frameworksTable,
  frameworkRequirementsTable,
  controlRequirementMapsTable,
  controlTestsTable,
} from "@workspace/db";

export interface ToolResult {
  data: Array<Record<string, unknown>>;
  total?: number;
}

export type ToolName =
  | "list_risks"
  | "list_vendors"
  | "list_signals"
  | "list_alerts"
  | "list_controls"
  | "list_kris"
  | "list_frameworks"
  | "run_gap_analysis"
  | "list_failed_control_tests";

export interface ToolCallParams {
  tenantId: string;
  since?: Date;
  status?: string;
  category?: string;
  source?: string;
  search?: string;
  type?: string;
  severity?: string;
  frameworkId?: string;
  page?: number;
  limit?: number;
  alertStatuses?: string[];
}

type ToolHandler = (params: ToolCallParams) => Promise<ToolResult>;

const toolHandlers: Record<ToolName, ToolHandler> = {
  list_risks: async ({ tenantId, status, category, search, page, limit: lim }) => {
    const conditions: SQL[] = [eq(risksTable.tenantId, tenantId)];
    if (status) conditions.push(sql`${risksTable.status} = ${status}`);
    if (category) conditions.push(sql`${risksTable.category} = ${category}`);
    if (search) conditions.push(ilike(risksTable.title, `%${search}%`));

    if (page && lim) {
      const offset = (page - 1) * lim;
      const [data, countResult] = await Promise.all([
        db.select().from(risksTable).where(and(...conditions)).limit(lim).offset(offset).orderBy(risksTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(risksTable).where(and(...conditions)),
      ]);
      return { data, total: countResult[0].count };
    }

    return {
      data: await db.select({
        id: risksTable.id, title: risksTable.title, description: risksTable.description,
        category: risksTable.category, status: risksTable.status,
        likelihood: risksTable.likelihood, impact: risksTable.impact,
        residualLikelihood: risksTable.residualLikelihood, residualImpact: risksTable.residualImpact,
      }).from(risksTable).where(and(...conditions)),
    };
  },

  list_vendors: async ({ tenantId, status, search, page, limit: lim }) => {
    const conditions: SQL[] = [eq(vendorsTable.tenantId, tenantId)];
    if (status) conditions.push(sql`${vendorsTable.status} = ${status}`);
    if (search) conditions.push(ilike(vendorsTable.name, `%${search}%`));

    if (page && lim) {
      const offset = (page - 1) * lim;
      const [data, countResult] = await Promise.all([
        db.select().from(vendorsTable).where(and(...conditions)).limit(lim).offset(offset).orderBy(vendorsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(vendorsTable).where(and(...conditions)),
      ]);
      return { data, total: countResult[0].count };
    }

    return {
      data: await db.select({
        id: vendorsTable.id, name: vendorsTable.name, tier: vendorsTable.tier,
        status: vendorsTable.status, riskScore: vendorsTable.riskScore, category: vendorsTable.category,
      }).from(vendorsTable).where(and(...conditions)),
    };
  },

  list_signals: async ({ tenantId, since, status, source, search, page, limit: lim }) => {
    const conditions: SQL[] = [eq(signalsTable.tenantId, tenantId)];
    if (status) conditions.push(sql`${signalsTable.status} = ${status}`);
    if (source) conditions.push(eq(signalsTable.source, source));
    if (search) conditions.push(ilike(signalsTable.content, `%${search}%`));
    if (since) conditions.push(gt(signalsTable.createdAt, since));

    if (page && lim) {
      const offset = (page - 1) * lim;
      const [data, countResult] = await Promise.all([
        db.select().from(signalsTable).where(and(...conditions)).limit(lim).offset(offset).orderBy(signalsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(signalsTable).where(and(...conditions)),
      ]);
      return { data, total: countResult[0].count };
    }

    return {
      data: await db.select({
        id: signalsTable.id, source: signalsTable.source, content: signalsTable.content,
        status: signalsTable.status, classification: signalsTable.classification,
        confidence: signalsTable.confidence,
      }).from(signalsTable).where(and(...conditions)),
    };
  },

  list_alerts: async ({ tenantId, severity, status, type, alertStatuses, page, limit: lim }) => {
    const conditions: SQL[] = [eq(alertsTable.tenantId, tenantId)];
    if (severity) conditions.push(sql`${alertsTable.severity} = ${severity}`);
    if (status) conditions.push(sql`${alertsTable.status} = ${status}`);
    if (type) conditions.push(eq(alertsTable.type, type));
    if (alertStatuses && alertStatuses.length > 0) {
      conditions.push(sql`${alertsTable.status} IN (${sql.join(alertStatuses.map(s => sql`${s}`), sql`, `)})`);
    }

    if (page && lim) {
      const offset = (page - 1) * lim;
      const [data, countResult] = await Promise.all([
        db.select().from(alertsTable).where(and(...conditions)).limit(lim).offset(offset).orderBy(alertsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(alertsTable).where(and(...conditions)),
      ]);
      return { data, total: countResult[0].count };
    }

    if (!alertStatuses && !status) {
      conditions.push(sql`${alertsTable.status} IN ('active', 'escalated')`);
    }

    return {
      data: await db.select({
        id: alertsTable.id, type: alertsTable.type, title: alertsTable.title,
        severity: alertsTable.severity, status: alertsTable.status, context: alertsTable.context,
      }).from(alertsTable).where(and(...conditions)),
    };
  },

  list_controls: async ({ tenantId, status, search, page, limit: lim }) => {
    const conditions: SQL[] = [eq(controlsTable.tenantId, tenantId)];
    if (status) conditions.push(sql`${controlsTable.status} = ${status}`);
    if (search) conditions.push(ilike(controlsTable.title, `%${search}%`));

    if (page && lim) {
      const offset = (page - 1) * lim;
      const [data, countResult] = await Promise.all([
        db.select().from(controlsTable).where(and(...conditions)).limit(lim).offset(offset).orderBy(controlsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(controlsTable).where(and(...conditions)),
      ]);
      return { data, total: countResult[0].count };
    }

    return {
      data: await db.select({
        id: controlsTable.id, title: controlsTable.title, status: controlsTable.status,
      }).from(controlsTable).where(and(...conditions)),
    };
  },

  list_kris: async ({ tenantId }) => ({
    data: await db.select({
      id: krisTable.id, riskId: krisTable.riskId, name: krisTable.name,
      currentValue: krisTable.currentValue, warningThreshold: krisTable.warningThreshold,
      criticalThreshold: krisTable.criticalThreshold, unit: krisTable.unit,
    }).from(krisTable).where(eq(krisTable.tenantId, tenantId)),
  }),

  list_frameworks: async ({ tenantId }) => ({
    data: await db.select({
      id: frameworksTable.id, name: frameworksTable.name, type: frameworksTable.type,
    }).from(frameworksTable).where(eq(frameworksTable.tenantId, tenantId)),
  }),

  run_gap_analysis: async ({ tenantId, frameworkId }) => {
    if (frameworkId) {
      const [framework] = await db.select().from(frameworksTable)
        .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId))).limit(1);
      if (!framework) return { data: [] };

      const requirements = await db.select().from(frameworkRequirementsTable)
        .where(and(eq(frameworkRequirementsTable.frameworkId, frameworkId), eq(frameworkRequirementsTable.tenantId, tenantId)));

      if (requirements.length === 0) return { data: [], total: 0 };

      const reqIds = requirements.map(r => r.id);
      const mappings = await db.select().from(controlRequirementMapsTable)
        .where(and(inArray(controlRequirementMapsTable.requirementId, reqIds), eq(controlRequirementMapsTable.tenantId, tenantId)));

      const coveredReqIds = new Set(mappings.map(m => m.requirementId));
      const gaps = requirements
        .filter(r => !coveredReqIds.has(r.id))
        .map(r => ({ id: r.id, code: r.code, title: r.title, frameworkId: r.frameworkId }));

      return { data: gaps, total: requirements.length };
    }

    return {
      data: await db.select({
        id: frameworkRequirementsTable.id,
        frameworkId: frameworkRequirementsTable.frameworkId,
        code: frameworkRequirementsTable.code,
        title: frameworkRequirementsTable.title,
      }).from(frameworkRequirementsTable)
        .where(and(
          eq(frameworkRequirementsTable.tenantId, tenantId),
          sql`${frameworkRequirementsTable.id} NOT IN (
            SELECT crm.requirement_id FROM control_requirement_maps crm
            INNER JOIN controls c ON c.id = crm.control_id
            WHERE c.tenant_id = ${tenantId}
          )`,
        )),
    };
  },

  list_failed_control_tests: async ({ tenantId, since }) => ({
    data: await db.select({
      id: controlTestsTable.id, controlId: controlTestsTable.controlId,
      result: controlTestsTable.result, notes: controlTestsTable.notes,
      testedAt: controlTestsTable.testedAt,
    }).from(controlTestsTable)
      .where(and(
        eq(controlTestsTable.tenantId, tenantId),
        sql`${controlTestsTable.result} IN ('fail', 'partial')`,
        since ? gt(controlTestsTable.testedAt, since) : undefined,
      )),
  }),
};

export async function invokeTool(name: ToolName, params: ToolCallParams): Promise<ToolResult> {
  const handler = toolHandlers[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(params);
}

export function getRegisteredTools(): ToolName[] {
  return Object.keys(toolHandlers) as ToolName[];
}
