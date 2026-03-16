import { pgTable, uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { risksTable } from "./risks";

export const krisTable = pgTable("kris", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  riskId: uuid("risk_id").notNull().references(() => risksTable.id),
  name: text("name").notNull(),
  description: text("description"),
  warningThreshold: numeric("warning_threshold", { precision: 12, scale: 2 }),
  criticalThreshold: numeric("critical_threshold", { precision: 12, scale: 2 }),
  currentValue: numeric("current_value", { precision: 12, scale: 2 }),
  unit: text("unit"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertKriSchema = createInsertSchema(krisTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKri = z.infer<typeof insertKriSchema>;
export type Kri = typeof krisTable.$inferSelect;
