import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";
import {
  db,
  risksTable,
  vendorsTable,
  signalsTable,
  alertsTable,
  controlsTable,
  frameworksTable,
  frameworkRequirementsTable,
  controlRequirementMapsTable,
} from "@workspace/db";
import { recordAuditDirect } from "../lib/audit";
import { getMcpAuth } from "./handler";

function rfc7807(status: number, title: string, detail: string) {
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

function getAuth() {
  const auth = getMcpAuth();
  if (!auth) return null;
  return auth;
}

function checkRole(user: { role: string }, ...allowed: string[]): boolean {
  return allowed.includes(user.role);
}

async function audit(tenantId: string, userId: string, action: string, entityType: string, entityId?: string, payload?: Record<string, unknown>) {
  await recordAuditDirect(tenantId, userId, action, entityType, entityId, payload);
}

export function registerMcpTools(mcp: McpServer) {
  mcp.tool(
    "list_risks",
    "List risks in the risk register with optional filters for status, category, and search",
    {
      status: z.enum(["draft", "open", "mitigated", "accepted", "closed"]).optional(),
      category: z.enum(["operational", "financial", "compliance", "strategic", "technology", "reputational"]).optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");

      const conditions = [eq(risksTable.tenantId, user.tenantId)];
      if (args.status) conditions.push(eq(risksTable.status, args.status));
      if (args.category) conditions.push(eq(risksTable.category, args.category));
      if (args.search) conditions.push(ilike(risksTable.title, `%${args.search}%`));

      const offset = (args.page - 1) * args.limit;
      const [risks, countResult] = await Promise.all([
        db.select().from(risksTable).where(and(...conditions)).limit(args.limit).offset(offset).orderBy(risksTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(risksTable).where(and(...conditions)),
      ]);

      await audit(user.tenantId, user.userId, "mcp_list", "risk");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: risks, total: countResult[0].count, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "create_risk",
    "Create a new risk entry in the risk register",
    {
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["operational", "financial", "compliance", "strategic", "technology", "reputational"]),
      likelihood: z.number().int().min(1).max(5),
      impact: z.number().int().min(1).max(5),
      status: z.enum(["draft", "open", "mitigated", "accepted", "closed"]).default("draft"),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return rfc7807(403, "Forbidden", "Insufficient permissions");

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
    {
      riskId: z.string().uuid(),
      title: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(["operational", "financial", "compliance", "strategic", "technology", "reputational"]).optional(),
      likelihood: z.number().int().min(1).max(5).optional(),
      impact: z.number().int().min(1).max(5).optional(),
      status: z.enum(["draft", "open", "mitigated", "accepted", "closed"]).optional(),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return rfc7807(403, "Forbidden", "Insufficient permissions");

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

      if (!updated) return rfc7807(404, "Not Found", "Risk not found");
      await audit(user.tenantId, user.userId, "mcp_update", "risk", updated.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    }
  );

  mcp.tool(
    "list_vendors",
    "List third-party vendors with optional status filter",
    {
      status: z.enum(["onboarding", "approved", "active", "suspended", "offboarded"]).optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");

      const conditions = [eq(vendorsTable.tenantId, user.tenantId)];
      if (args.status) conditions.push(eq(vendorsTable.status, args.status));
      if (args.search) conditions.push(ilike(vendorsTable.name, `%${args.search}%`));

      const offset = (args.page - 1) * args.limit;
      const [vendors, countResult] = await Promise.all([
        db.select().from(vendorsTable).where(and(...conditions)).limit(args.limit).offset(offset).orderBy(vendorsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(vendorsTable).where(and(...conditions)),
      ]);

      await audit(user.tenantId, user.userId, "mcp_list", "vendor");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: vendors, total: countResult[0].count, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "create_vendor",
    "Register a new third-party vendor",
    {
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
      tier: z.enum(["critical", "high", "medium", "low"]),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return rfc7807(403, "Forbidden", "Insufficient permissions");

      const [vendor] = await db.insert(vendorsTable).values({
        tenantId: user.tenantId,
        name: args.name,
        description: args.description || null,
        category: args.category || null,
        tier: args.tier,
        contactName: args.contactName || null,
        contactEmail: args.contactEmail || null,
      }).returning();

      await audit(user.tenantId, user.userId, "mcp_create", "vendor", vendor.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(vendor) }] };
    }
  );

  mcp.tool(
    "list_signals",
    "List ingested signals with optional status and source filters",
    {
      status: z.enum(["pending", "triaged", "finding", "dismissed"]).optional(),
      source: z.string().optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");

      const conditions = [eq(signalsTable.tenantId, user.tenantId)];
      if (args.status) conditions.push(eq(signalsTable.status, args.status));
      if (args.source) conditions.push(eq(signalsTable.source, args.source));
      if (args.search) conditions.push(ilike(signalsTable.content, `%${args.search}%`));

      const offset = (args.page - 1) * args.limit;
      const [signals, countResult] = await Promise.all([
        db.select().from(signalsTable).where(and(...conditions)).limit(args.limit).offset(offset).orderBy(signalsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(signalsTable).where(and(...conditions)),
      ]);

      await audit(user.tenantId, user.userId, "mcp_list", "signal");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: signals, total: countResult[0].count, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "triage_signal",
    "Triage a pending signal — transition it to 'triaged' status",
    {
      signalId: z.string().uuid(),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager", "auditor")) return rfc7807(403, "Forbidden", "Insufficient permissions");

      const [signal] = await db.select().from(signalsTable)
        .where(and(eq(signalsTable.id, args.signalId), eq(signalsTable.tenantId, user.tenantId))).limit(1);

      if (!signal) return rfc7807(404, "Not Found", "Signal not found");
      if (signal.status !== "pending") return rfc7807(409, "Conflict", `Signal is '${signal.status}', only 'pending' signals can be triaged`);

      const [updated] = await db.update(signalsTable).set({ status: "triaged", updatedAt: new Date() })
        .where(eq(signalsTable.id, args.signalId)).returning();

      await audit(user.tenantId, user.userId, "mcp_triage", "signal", updated.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    }
  );

  mcp.tool(
    "list_alerts",
    "List monitoring alerts with optional severity and status filters",
    {
      severity: z.enum(["critical", "high", "medium", "low"]).optional(),
      status: z.enum(["active", "acknowledged", "resolved", "escalated"]).optional(),
      type: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");

      const conditions = [eq(alertsTable.tenantId, user.tenantId)];
      if (args.severity) conditions.push(eq(alertsTable.severity, args.severity));
      if (args.status) conditions.push(eq(alertsTable.status, args.status));
      if (args.type) conditions.push(eq(alertsTable.type, args.type));

      const offset = (args.page - 1) * args.limit;
      const [alerts, countResult] = await Promise.all([
        db.select().from(alertsTable).where(and(...conditions)).limit(args.limit).offset(offset).orderBy(alertsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(alertsTable).where(and(...conditions)),
      ]);

      await audit(user.tenantId, user.userId, "mcp_list", "alert");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: alerts, total: countResult[0].count, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "acknowledge_alert",
    "Acknowledge an active alert",
    {
      alertId: z.string().uuid(),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager", "auditor")) return rfc7807(403, "Forbidden", "Insufficient permissions");

      const [alert] = await db.select().from(alertsTable)
        .where(and(eq(alertsTable.id, args.alertId), eq(alertsTable.tenantId, user.tenantId))).limit(1);

      if (!alert) return rfc7807(404, "Not Found", "Alert not found");
      if (alert.status !== "active" && alert.status !== "escalated") {
        return rfc7807(409, "Conflict", `Alert is '${alert.status}', only active or escalated alerts can be acknowledged`);
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
    {
      frameworkId: z.string().uuid(),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");

      const [framework] = await db.select().from(frameworksTable)
        .where(and(eq(frameworksTable.id, args.frameworkId), eq(frameworksTable.tenantId, user.tenantId))).limit(1);
      if (!framework) return rfc7807(404, "Not Found", "Framework not found");

      const requirements = await db.select().from(frameworkRequirementsTable)
        .where(eq(frameworkRequirementsTable.frameworkId, args.frameworkId));

      if (requirements.length === 0) {
        await audit(user.tenantId, user.userId, "mcp_compliance_score", "framework", args.frameworkId);
        return { content: [{ type: "text" as const, text: JSON.stringify({ framework: framework.name, totalRequirements: 0, coveredRequirements: 0, score: 0 }) }] };
      }

      const reqIds = requirements.map(r => r.id);
      const mappings = await db.select().from(controlRequirementMapsTable)
        .where(inArray(controlRequirementMapsTable.requirementId, reqIds));

      const coveredReqIds = new Set(mappings.map(m => m.requirementId));

      const score = {
        framework: framework.name,
        totalRequirements: requirements.length,
        coveredRequirements: coveredReqIds.size,
        score: Math.round((coveredReqIds.size / requirements.length) * 100),
      };

      await audit(user.tenantId, user.userId, "mcp_compliance_score", "framework", args.frameworkId);
      return { content: [{ type: "text" as const, text: JSON.stringify(score) }] };
    }
  );

  mcp.tool(
    "run_gap_analysis",
    "Run gap analysis for a compliance framework, identifying requirements without mapped controls",
    {
      frameworkId: z.string().uuid(),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");

      const [framework] = await db.select().from(frameworksTable)
        .where(and(eq(frameworksTable.id, args.frameworkId), eq(frameworksTable.tenantId, user.tenantId))).limit(1);
      if (!framework) return rfc7807(404, "Not Found", "Framework not found");

      const requirements = await db.select().from(frameworkRequirementsTable)
        .where(eq(frameworkRequirementsTable.frameworkId, args.frameworkId));

      if (requirements.length === 0) {
        await audit(user.tenantId, user.userId, "mcp_gap_analysis", "framework", args.frameworkId);
        return { content: [{ type: "text" as const, text: JSON.stringify({ framework: framework.name, gaps: [], totalRequirements: 0, gapCount: 0 }) }] };
      }

      const reqIds = requirements.map(r => r.id);
      const mappings = await db.select().from(controlRequirementMapsTable)
        .where(inArray(controlRequirementMapsTable.requirementId, reqIds));

      const coveredReqIds = new Set(mappings.map(m => m.requirementId));
      const gaps = requirements
        .filter(r => !coveredReqIds.has(r.id))
        .map(r => ({ id: r.id, code: r.code, title: r.title, description: r.description }));

      await audit(user.tenantId, user.userId, "mcp_gap_analysis", "framework", args.frameworkId);
      return { content: [{ type: "text" as const, text: JSON.stringify({ framework: framework.name, gaps, totalRequirements: requirements.length, gapCount: gaps.length }) }] };
    }
  );

  mcp.tool(
    "list_controls",
    "List compliance controls with optional status filter",
    {
      status: z.enum(["active", "inactive", "planned"]).optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");

      const conditions = [eq(controlsTable.tenantId, user.tenantId)];
      if (args.status) conditions.push(eq(controlsTable.status, args.status));
      if (args.search) conditions.push(ilike(controlsTable.title, `%${args.search}%`));

      const offset = (args.page - 1) * args.limit;
      const [controls, countResult] = await Promise.all([
        db.select().from(controlsTable).where(and(...conditions)).limit(args.limit).offset(offset).orderBy(controlsTable.createdAt),
        db.select({ count: sql<number>`count(*)::int` }).from(controlsTable).where(and(...conditions)),
      ]);

      await audit(user.tenantId, user.userId, "mcp_list", "control");
      return { content: [{ type: "text" as const, text: JSON.stringify({ data: controls, total: countResult[0].count, page: args.page, limit: args.limit }) }] };
    }
  );

  mcp.tool(
    "create_control",
    "Create a new compliance control",
    {
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(["active", "inactive", "planned"]).default("planned"),
      ownerId: z.string().uuid().optional(),
    },
    async (args) => {
      const user = getAuth();
      if (!user) return rfc7807(401, "Unauthorized", "Authentication required");
      if (!checkRole(user, "admin", "risk_manager")) return rfc7807(403, "Forbidden", "Insufficient permissions");

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
