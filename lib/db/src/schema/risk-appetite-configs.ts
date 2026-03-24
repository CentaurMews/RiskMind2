import { pgTable, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { riskCategoryEnum } from "./risks";

export const riskAppetiteConfigsTable = pgTable("risk_appetite_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  category: riskCategoryEnum("category").notNull(),
  threshold: integer("threshold").notNull().default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("risk_appetite_tenant_category_idx").on(t.tenantId, t.category),
]);

export const insertRiskAppetiteConfigSchema = createInsertSchema(riskAppetiteConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRiskAppetiteConfig = z.infer<typeof insertRiskAppetiteConfigSchema>;
export type RiskAppetiteConfig = typeof riskAppetiteConfigsTable.$inferSelect;
