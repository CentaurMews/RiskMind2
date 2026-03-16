import { pgTable, uuid, text, timestamp, jsonb, pgEnum, integer, real, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const agentFindingTypeEnum = pgEnum("agent_finding_type", [
  "cascade_chain",
  "cluster",
  "predictive_signal",
  "anomaly",
  "cross_domain",
  "recommendation",
]);

export const agentFindingSeverityEnum = pgEnum("agent_finding_severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const agentFindingStatusEnum = pgEnum("agent_finding_status", [
  "pending_review",
  "acknowledged",
  "dismissed",
  "actioned",
]);

export const agentPolicyTierEnum = pgEnum("agent_policy_tier", [
  "observe",
  "advisory",
  "active",
]);

export const agentRunsTable = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  status: agentRunStatusEnum("status").notNull().default("running"),
  policyTier: agentPolicyTierEnum("policy_tier").notNull().default("observe"),
  model: text("model"),
  tokenCount: integer("token_count").default(0),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 6 }).default("0"),
  durationMs: integer("duration_ms"),
  findingCount: integer("finding_count").default(0),
  error: text("error"),
  context: jsonb("context").default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentFindingsTable = pgTable("agent_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  runId: uuid("run_id").notNull().references(() => agentRunsTable.id),
  type: agentFindingTypeEnum("type").notNull(),
  severity: agentFindingSeverityEnum("severity").notNull().default("medium"),
  title: text("title").notNull(),
  narrative: text("narrative").notNull(),
  linkedEntities: jsonb("linked_entities").default([]),
  proposedAction: jsonb("proposed_action"),
  status: agentFindingStatusEnum("status").notNull().default("pending_review"),
  dismissedReason: text("dismissed_reason"),
  actionedAt: timestamp("actioned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAgentRunSchema = createInsertSchema(agentRunsTable).omit({ id: true, createdAt: true });
export type InsertAgentRun = z.infer<typeof insertAgentRunSchema>;
export type AgentRun = typeof agentRunsTable.$inferSelect;

export const insertAgentFindingSchema = createInsertSchema(agentFindingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgentFinding = z.infer<typeof insertAgentFindingSchema>;
export type AgentFinding = typeof agentFindingsTable.$inferSelect;
