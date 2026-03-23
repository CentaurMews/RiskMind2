import { pgTable, uuid, text, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { vendorsTable } from "./vendors";

export const orgDependencyCategoryEnum = pgEnum("org_dependency_category", [
  "email",
  "cloud",
  "cdn",
  "identity",
  "payment",
  "communication",
  "other",
]);

export const orgDependenciesTable = pgTable("org_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  category: orgDependencyCategoryEnum("category").notNull(),
  providerName: text("provider_name").notNull(),
  vendorId: uuid("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
  criticality: text("criticality"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("org_dependencies_tenant_idx").on(t.tenantId, t.category),
]);

export const insertOrgDependencySchema = createInsertSchema(orgDependenciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgDependency = z.infer<typeof insertOrgDependencySchema>;
export type OrgDependency = typeof orgDependenciesTable.$inferSelect;
