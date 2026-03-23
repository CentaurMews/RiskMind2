import { pgTable, uuid, text, timestamp, boolean, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const integrationSourceTypeEnum = pgEnum("integration_source_type", [
  "nvd",
  "shodan",
  "sentinel",
  "misp",
  "email",
]);

export const integrationConfigsTable = pgTable("integration_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  sourceType: integrationSourceTypeEnum("source_type").notNull(),
  encryptedConfig: text("encrypted_config"),
  pollingSchedule: text("polling_schedule"),
  isActive: boolean("is_active").notNull().default(true),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("integration_configs_tenant_source_idx").on(t.tenantId, t.sourceType),
]);

export const insertIntegrationConfigSchema = createInsertSchema(integrationConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationConfig = z.infer<typeof insertIntegrationConfigSchema>;
export type IntegrationConfig = typeof integrationConfigsTable.$inferSelect;
