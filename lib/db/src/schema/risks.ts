import { pgTable, uuid, text, timestamp, integer, pgEnum, vector, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const riskStatusEnum = pgEnum("risk_status", [
  "draft",
  "open",
  "mitigated",
  "accepted",
  "closed",
]);

export const riskCategoryEnum = pgEnum("risk_category", [
  "operational",
  "financial",
  "compliance",
  "strategic",
  "technology",
  "reputational",
]);

export const risksTable = pgTable("risks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  category: riskCategoryEnum("category").notNull(),
  status: riskStatusEnum("status").notNull().default("draft"),
  ownerId: uuid("owner_id").references(() => usersTable.id),
  likelihood: integer("likelihood").notNull().default(1),
  impact: integer("impact").notNull().default(1),
  residualLikelihood: integer("residual_likelihood"),
  residualImpact: integer("residual_impact"),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const riskSourceTypeEnum = pgEnum("risk_source_type", [
  "signal",
  "finding",
  "agent_detection",
]);

export const riskSourcesTable = pgTable("risk_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  riskId: uuid("risk_id").notNull().references(() => risksTable.id, { onDelete: "cascade" }),
  sourceType: riskSourceTypeEnum("source_type").notNull(),
  sourceId: uuid("source_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRiskSchema = createInsertSchema(risksTable).omit({ id: true, createdAt: true, updatedAt: true, embedding: true });
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type Risk = typeof risksTable.$inferSelect;

export const insertRiskSourceSchema = createInsertSchema(riskSourcesTable).omit({ id: true, createdAt: true });
export type InsertRiskSource = z.infer<typeof insertRiskSourceSchema>;
export type RiskSource = typeof riskSourcesTable.$inferSelect;
