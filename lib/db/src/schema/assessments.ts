import { pgTable, uuid, text, timestamp, jsonb, numeric, integer, boolean, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const assessmentContextTypeEnum = pgEnum("assessment_context_type", [
  "vendor",
  "framework",
]);

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "draft",
  "active",
  "completed",
  "abandoned",
]);

export const assessmentTemplatesTable = pgTable("assessment_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  questions: jsonb("questions").notNull().default([]),
  contextType: assessmentContextTypeEnum("context_type").notNull(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("assessment_templates_tenant_idx").on(t.tenantId, t.createdAt),
]);

export const assessmentsTable = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  templateId: uuid("template_id").notNull().references(() => assessmentTemplatesTable.id),
  contextType: assessmentContextTypeEnum("context_type").notNull(),
  contextId: uuid("context_id"),
  status: assessmentStatusEnum("assessment_status").notNull().default("draft"),
  responses: jsonb("responses").notNull().default({}),
  score: numeric("score", { precision: 5, scale: 2 }),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("assessments_tenant_context_idx").on(t.tenantId, t.contextType, t.contextId),
  index("assessments_tenant_status_idx").on(t.tenantId, t.status),
]);

export const insertAssessmentTemplateSchema = createInsertSchema(assessmentTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssessmentTemplate = z.infer<typeof insertAssessmentTemplateSchema>;
export type AssessmentTemplate = typeof assessmentTemplatesTable.$inferSelect;

export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessmentsTable.$inferSelect;
