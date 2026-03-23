import { pgTable, uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const frameworksTable = pgTable("frameworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  version: text("version"),
  type: text("type"),
  description: text("description"),
  complianceThreshold: numeric("compliance_threshold", { precision: 5, scale: 2 }),
  importSource: text("import_source"),
  importReference: text("import_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFrameworkSchema = createInsertSchema(frameworksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFramework = z.infer<typeof insertFrameworkSchema>;
export type Framework = typeof frameworksTable.$inferSelect;
