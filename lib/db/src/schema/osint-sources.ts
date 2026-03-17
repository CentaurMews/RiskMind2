import { pgTable, uuid, text, timestamp, boolean, jsonb, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const osintSourceTypeEnum = pgEnum("osint_source_type", [
  "perplexity",
  "alienvault_otx",
  "censys",
  "nvd_cisa",
  "email_imap",
]);

export const osintSourceStatusEnum = pgEnum("osint_source_status", [
  "success",
  "failed",
  "pending",
  "never_run",
]);

export const osintSourceConfigsTable = pgTable("osint_source_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  sourceType: osintSourceTypeEnum("source_type").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  encryptedCredentials: text("encrypted_credentials"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunStatus: osintSourceStatusEnum("last_run_status").notNull().default("never_run"),
  lastRunError: text("last_run_error"),
  lastRunSummary: jsonb("last_run_summary").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("uq_osint_source_configs_tenant_source").on(t.tenantId, t.sourceType),
]);

export const insertOsintSourceConfigSchema = createInsertSchema(osintSourceConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOsintSourceConfig = z.infer<typeof insertOsintSourceConfigSchema>;
export type OsintSourceConfig = typeof osintSourceConfigsTable.$inferSelect;
