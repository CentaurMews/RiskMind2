import { pgTable, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { vendorTierEnum } from "./vendors";
import { assessmentTemplatesTable } from "./assessments";

export const monitoringConfigsTable = pgTable("monitoring_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  tier: vendorTierEnum("tier").notNull(),
  cadenceDays: integer("cadence_days").notNull(),
  scoreThreshold: integer("score_threshold"),  // nullable — alert when vendor riskScore >= this value (0-100 scale, higher = worse)
  assessmentTemplateId: uuid("assessment_template_id").references(() => assessmentTemplatesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("monitoring_configs_tenant_tier_idx").on(t.tenantId, t.tier),
]);

export const insertMonitoringConfigSchema = createInsertSchema(monitoringConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMonitoringConfig = z.infer<typeof insertMonitoringConfigSchema>;
export type MonitoringConfig = typeof monitoringConfigsTable.$inferSelect;
