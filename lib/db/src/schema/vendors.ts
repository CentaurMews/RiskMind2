import { pgTable, uuid, text, timestamp, numeric, pgEnum, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const vendorTierEnum = pgEnum("vendor_tier", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const vendorStatusEnum = pgEnum("vendor_status", [
  "identification",
  "due_diligence",
  "risk_assessment",
  "contracting",
  "onboarding",
  "monitoring",
  "offboarding",
]);

export const vendorsTable = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  tier: vendorTierEnum("tier").notNull().default("medium"),
  status: vendorStatusEnum("vendor_status").notNull().default("identification"),
  category: text("category"),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }),
  overrideTier: vendorTierEnum("override_tier"),
  overrideReason: text("override_reason"),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true, updatedAt: true, embedding: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
