import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { signalsTable } from "./signals";
import { risksTable } from "./risks";
import { vendorsTable } from "./vendors";

export const findingStatusEnum = pgEnum("finding_status", [
  "open",
  "investigating",
  "resolved",
  "false_positive",
]);

export const findingsTable = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  signalId: uuid("signal_id").references(() => signalsTable.id),
  riskId: uuid("risk_id").references(() => risksTable.id),
  vendorId: uuid("vendor_id").references(() => vendorsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  status: findingStatusEnum("finding_status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFindingSchema = createInsertSchema(findingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type Finding = typeof findingsTable.$inferSelect;
