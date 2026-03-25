import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  db,
  risksTable,
  vendorsTable,
  signalsTable,
  alertsTable,
  controlsTable,
} from "@workspace/db";
import { computeTierFromRiskScore } from "../lib/allowed-transitions";
import {
  ListRisksQueryParams,
  CreateRiskBody,
  UpdateRiskBody,
  ListVendorsQueryParams,
  CreateVendorBody,
  ListControlsQueryParams,
  CreateControlBody,
  ListSignalsQueryParams,
  ListAlertsQueryParams,
  AcknowledgeAlertParams,
  GetComplianceScoreParams,
  GetGapAnalysisParams,
} from "@workspace/api-zod";
import { recordAuditDirect } from "../lib/audit";
import { getMcpAuthBySessionId, type McpAuthContext } from "./handler";
import { invokeTool } from "../lib/tool-registry";

function rfc7807(status: number, title: string, detail: string, auditCtx?: { tenantId: string; userId: string; tool: string }) {
  if (auditCtx) {
    audit(auditCtx.tenantId, auditCtx.userId, `mcp_denied`, auditCtx.tool, undefined, { status, title, detail }).catch(auditErr => console.error("[mcp] audit log failed:", auditErr.message));
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      type: `https://riskmind.app/errors/${title.toLowerCase().replace(/\s+/g, "-")}`,
      title,
      status,
      detail,
    }) }],
    isError: true,
  };
}

function authError(status: number, title: string, detail: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      type: `https://riskmind.app/errors/${title.toLowerCase().replace(/\s+/g, "-")}`,
      title,
      status,
      detail,
    }) }],
    isError: true,
  };
}

function getAuth(extra: { sessionId?: string }): McpAuthContext | null {
  return getMcpAuthBySessionId(extra.sessionId);
}

function checkRole(user: { role: string }, ...allowed: string[]): boolean {
  return allowed.includes(user.role);
}

function deny(user: McpAuthContext, tool: string, status: number, title: string, detail: string) {
  return rfc7807(status, title, detail, { tenantId: user.tenantId, userId: user.userId, tool });
}

async function audit(tenantId: string, userId: string, action: string, entityType: string, entityId?: string, payload?: Record<string, unknown>) {
  await recordAuditDirect(tenantId, userId, action, entityType, entityId, payload);
}

export function registerMcpTools(mcp: McpServer) {
  mcp.tool(
    "list_risks",
    "List risks in the risk register with optional filters for status, category, and search",
    ListRisksQueryParams.pick({ status: true, category: true, search: true, page: true, limit: true }).shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");

      const result = await invokeTool("list_risks", {
        tenantId: user.tenantId,
        status: args.status,
        category: args.category,
        search: args.search,
        page: args.page,
        limit: args.limit,
      });

      await audit(user.tenantId, user.userId, "mcp_list", "risk");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: result.data, total: result.total, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "create_risk",
    "Create a new risk entry in the risk register",
    CreateRiskBody.extend({ likelihood: z.number().int().min(1).max(5), impact: z.number().int().min(1).max(5) }).shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return deny(user, "create_risk", 403, "Forbidden", "Insufficient permissions");

      const [risk] = await db.insert(risksTable).values({
        tenantId: user.tenantId,
        ownerId: user.userId,
        title: args.title,
        description: args.description || null,
        category: args.category,
        likelihood: args.likelihood,
        impact: args.impact,
        status: args.status,
      }).returning();

      await audit(user.tenantId, user.userId, "mcp_create", "risk", risk.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(risk) }] };
    }
  );

  mcp.tool(
    "update_risk",
    "Update an existing risk entry",
    UpdateRiskBody.extend({
      riskId: z.string().uuid(),
      likelihood: z.number().int().min(1).max(5).optional(),
      impact: z.number().int().min(1).max(5).optional(),
    }).shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return deny(user, "update_risk", 403, "Forbidden", "Insufficient permissions");

      const { riskId, ...updates } = args;
      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.title !== undefined) setFields.title = updates.title;
      if (updates.description !== undefined) setFields.description = updates.description;
      if (updates.category !== undefined) setFields.category = updates.category;
      if (updates.likelihood !== undefined) setFields.likelihood = updates.likelihood;
      if (updates.impact !== undefined) setFields.impact = updates.impact;
      if (updates.status !== undefined) setFields.status = updates.status;

      const [updated] = await db.update(risksTable).set(setFields)
        .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, user.tenantId))).returning();

      if (!updated) return deny(user, "update_risk", 404, "Not Found", "Risk not found");
      await audit(user.tenantId, user.userId, "mcp_update", "risk", updated.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    }
  );

  mcp.tool(
    "list_vendors",
    "List third-party vendors with optional status filter",
    ListVendorsQueryParams.pick({ status: true, search: true, page: true, limit: true }).shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");

      const result = await invokeTool("list_vendors", {
        tenantId: user.tenantId,
        status: args.status,
        search: args.search,
        page: args.page,
        limit: args.limit,
      });

      await audit(user.tenantId, user.userId, "mcp_list", "vendor");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: result.data, total: result.total, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "create_vendor",
    "Register a new third-party vendor",
    CreateVendorBody.shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return deny(user, "create_vendor", 403, "Forbidden", "Insufficient permissions");

      const computedTier = args.riskScore != null ? computeTierFromRiskScore(args.riskScore) : "medium" as const;
      const [vendor] = await db.insert(vendorsTable).values({
        tenantId: user.tenantId,
        name: args.name,
        description: args.description || null,
        category: args.category || null,
        contactName: args.contactName || null,
        contactEmail: args.contactEmail || null,
        tier: computedTier,
        ...(args.riskScore != null && { riskScore: String(args.riskScore) }),
      }).returning();

      await audit(user.tenantId, user.userId, "mcp_create", "vendor", vendor.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(vendor) }] };
    }
  );

  mcp.tool(
    "list_signals",
    "List ingested signals with optional status and source filters",
    ListSignalsQueryParams.shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");

      const result = await invokeTool("list_signals", {
        tenantId: user.tenantId,
        status: args.status,
        source: args.source,
        search: args.search,
        page: args.page,
        limit: args.limit,
      });

      await audit(user.tenantId, user.userId, "mcp_list", "signal");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: result.data, total: result.total, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "triage_signal",
    "Triage a pending signal — transition it to 'triaged' status",
    {
      signalId: z.string().uuid(),
    },
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager", "auditor")) return deny(user, "triage_signal", 403, "Forbidden", "Insufficient permissions");

      const [signal] = await db.select().from(signalsTable)
        .where(and(eq(signalsTable.id, args.signalId), eq(signalsTable.tenantId, user.tenantId))).limit(1);

      if (!signal) return deny(user, "triage_signal", 404, "Not Found", "Signal not found");
      if (signal.status !== "pending") return deny(user, "triage_signal", 409, "Conflict", `Signal is '${signal.status}', only 'pending' signals can be triaged`);

      const [updated] = await db.update(signalsTable).set({ status: "triaged", updatedAt: new Date() })
        .where(eq(signalsTable.id, args.signalId)).returning();

      await audit(user.tenantId, user.userId, "mcp_triage", "signal", updated.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    }
  );

  mcp.tool(
    "list_alerts",
    "List monitoring alerts with optional severity and status filters",
    ListAlertsQueryParams.shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");

      const result = await invokeTool("list_alerts", {
        tenantId: user.tenantId,
        severity: args.severity,
        status: args.status,
        type: args.type,
        page: args.page,
        limit: args.limit,
        alertStatuses: args.status ? [args.status] : undefined,
      });

      await audit(user.tenantId, user.userId, "mcp_list", "alert");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: result.data, total: result.total, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "acknowledge_alert",
    "Acknowledge an active alert",
    { alertId: AcknowledgeAlertParams.shape.id },
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager", "auditor")) return deny(user, "acknowledge_alert", 403, "Forbidden", "Insufficient permissions");

      const [alert] = await db.select().from(alertsTable)
        .where(and(eq(alertsTable.id, args.alertId), eq(alertsTable.tenantId, user.tenantId))).limit(1);

      if (!alert) return deny(user, "acknowledge_alert", 404, "Not Found", "Alert not found");
      if (alert.status !== "active" && alert.status !== "escalated") {
        return deny(user, "acknowledge_alert", 409, "Conflict", `Alert is '${alert.status}', only active or escalated alerts can be acknowledged`);
      }

      const [updated] = await db.update(alertsTable)
        .set({ status: "acknowledged", acknowledgedBy: user.userId, acknowledgedAt: new Date(), updatedAt: new Date() })
        .where(eq(alertsTable.id, args.alertId)).returning();

      await audit(user.tenantId, user.userId, "mcp_acknowledge", "alert", updated.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    }
  );

  mcp.tool(
    "get_compliance_score",
    "Get compliance score for a framework showing coverage of requirements by controls",
    GetComplianceScoreParams.shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");

      const gapResult = await invokeTool("run_gap_analysis", {
        tenantId: user.tenantId,
        frameworkId: args.frameworkId,
      });

      const totalRequirements = gapResult.total || 0;
      const gapCount = gapResult.data.length;
      const coveredRequirements = totalRequirements - gapCount;

      const { db: dbLocal } = await import("@workspace/db");
      const { frameworksTable: ft } = await import("@workspace/db");
      const [framework] = await dbLocal.select().from(ft)
        .where(and(eq(ft.id, args.frameworkId), eq(ft.tenantId, user.tenantId))).limit(1);
      if (!framework) return deny(user, "get_compliance_score", 404, "Not Found", "Framework not found");

      const score = {
        framework: framework.name,
        totalRequirements,
        coveredRequirements,
        score: totalRequirements > 0 ? Math.round((coveredRequirements / totalRequirements) * 100) : 0,
      };

      await audit(user.tenantId, user.userId, "mcp_compliance_score", "framework", args.frameworkId);
      return { content: [{ type: "text" as const, text: JSON.stringify(score) }] };
    }
  );

  mcp.tool(
    "run_gap_analysis",
    "Run gap analysis for a compliance framework, identifying requirements without mapped controls",
    GetGapAnalysisParams.shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");

      const { db: dbLocal } = await import("@workspace/db");
      const { frameworksTable: ft } = await import("@workspace/db");
      const [framework] = await dbLocal.select().from(ft)
        .where(and(eq(ft.id, args.frameworkId), eq(ft.tenantId, user.tenantId))).limit(1);
      if (!framework) return deny(user, "run_gap_analysis", 404, "Not Found", "Framework not found");

      const gapResult = await invokeTool("run_gap_analysis", {
        tenantId: user.tenantId,
        frameworkId: args.frameworkId,
      });

      await audit(user.tenantId, user.userId, "mcp_gap_analysis", "framework", args.frameworkId);
      return { content: [{ type: "text" as const, text: JSON.stringify({
        framework: framework.name,
        gaps: gapResult.data,
        totalRequirements: gapResult.total || 0,
        gapCount: gapResult.data.length,
      }) }] };
    }
  );

  mcp.tool(
    "list_controls",
    "List compliance controls with optional status filter",
    ListControlsQueryParams.extend({ search: z.string().optional() }).shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");

      const result = await invokeTool("list_controls", {
        tenantId: user.tenantId,
        status: args.status,
        search: args.search,
        page: args.page,
        limit: args.limit,
      });

      await audit(user.tenantId, user.userId, "mcp_list", "control");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: result.data, total: result.total, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "create_control",
    "Create a new compliance control",
    CreateControlBody.omit({ requirementIds: true }).shape,
    async (args, extra) => {
      const user = getAuth(extra);
      if (!user) return authError(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return deny(user, "create_control", 403, "Forbidden", "Insufficient permissions");

      const [control] = await db.insert(controlsTable).values({
        tenantId: user.tenantId,
        title: args.title,
        description: args.description || null,
        status: args.status,
        ownerId: args.ownerId || user.userId,
      }).returning();

      await audit(user.tenantId, user.userId, "mcp_create", "control", control.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(control) }] };
    }
  );
}
