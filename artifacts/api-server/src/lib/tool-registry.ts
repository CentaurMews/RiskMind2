import { eq, and, sql, gt, inArray } from "drizzle-orm";
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
  controlTestsTable,
} from "@workspace/db";

export interface ToolResult {
  data: Array<Record<string, unknown>>;
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
}

const toolHandlers: Record<ToolName, (params: ToolCallParams) => Promise<ToolResult>> = {
  list_risks: async ({ tenantId }) => ({
    data: await db.select({
      id: risksTable.id, title: risksTable.title, description: risksTable.description,
      category: risksTable.category, status: risksTable.status,
      likelihood: risksTable.likelihood, impact: risksTable.impact,
      residualLikelihood: risksTable.residualLikelihood, residualImpact: risksTable.residualImpact,
    }).from(risksTable).where(eq(risksTable.tenantId, tenantId)),
  }),

  list_vendors: async ({ tenantId }) => ({
    data: await db.select({
      id: vendorsTable.id, name: vendorsTable.name, tier: vendorsTable.tier,
      status: vendorsTable.status, riskScore: vendorsTable.riskScore, category: vendorsTable.category,
    }).from(vendorsTable).where(eq(vendorsTable.tenantId, tenantId)),
  }),

  list_signals: async ({ tenantId, since }) => ({
    data: await db.select({
      id: signalsTable.id, source: signalsTable.source, content: signalsTable.content,
      status: signalsTable.status, classification: signalsTable.classification,
      confidence: signalsTable.confidence,
    }).from(signalsTable)
      .where(and(
        eq(signalsTable.tenantId, tenantId),
        since ? gt(signalsTable.createdAt, since) : undefined,
      )),
  }),

  list_alerts: async ({ tenantId }) => ({
    data: await db.select({
      id: alertsTable.id, type: alertsTable.type, title: alertsTable.title,
      severity: alertsTable.severity, status: alertsTable.status, context: alertsTable.context,
    }).from(alertsTable)
      .where(and(eq(alertsTable.tenantId, tenantId), inArray(alertsTable.status, ["active", "escalated"]))),
  }),

  list_controls: async ({ tenantId }) => ({
    data: await db.select({
      id: controlsTable.id, title: controlsTable.title, status: controlsTable.status,
    }).from(controlsTable).where(eq(controlsTable.tenantId, tenantId)),
  }),

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

  run_gap_analysis: async ({ tenantId }) => ({
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
  }),

  list_failed_control_tests: async ({ tenantId, since }) => ({
    data: await db.select({
      id: controlTestsTable.id, controlId: controlTestsTable.controlId,
      result: controlTestsTable.result, notes: controlTestsTable.notes,
      testedAt: controlTestsTable.testedAt,
    }).from(controlTestsTable)
      .where(and(
        eq(controlTestsTable.tenantId, tenantId),
        inArray(controlTestsTable.result, ["fail", "partial"]),
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
