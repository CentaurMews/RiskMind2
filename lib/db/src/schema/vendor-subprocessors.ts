import { pgTable, uuid, text, timestamp, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { vendorsTable } from "./vendors";

export const subprocessorCriticalityEnum = pgEnum("subprocessor_criticality", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const subprocessorDiscoveredByEnum = pgEnum("subprocessor_discovered_by", [
  "manual",
  "llm",
]);

export const vendorSubprocessorsTable = pgTable("vendor_subprocessors", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id),
  subprocessorId: uuid("subprocessor_id").notNull().references(() => vendorsTable.id),
  relationshipType: text("relationship_type"),
  criticality: subprocessorCriticalityEnum("criticality").notNull().default("medium"),
  discoveredBy: subprocessorDiscoveredByEnum("discovered_by").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("vendor_subprocessors_pair_idx").on(t.vendorId, t.subprocessorId),
]);

export const insertVendorSubprocessorSchema = createInsertSchema(vendorSubprocessorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendorSubprocessor = z.infer<typeof insertVendorSubprocessorSchema>;
export type VendorSubprocessor = typeof vendorSubprocessorsTable.$inferSelect;
