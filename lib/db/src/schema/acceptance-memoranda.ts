import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { risksTable } from "./risks";
import { treatmentsTable } from "./treatments";
import { usersTable } from "./users";

export const memorandumStatusEnum = pgEnum("memorandum_status", [
  "pending_approval",
  "approved",
  "rejected",
]);

export const acceptanceMemorandaTable = pgTable("acceptance_memoranda", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  riskId: uuid("risk_id").notNull().references(() => risksTable.id, { onDelete: "cascade" }),
  treatmentId: uuid("treatment_id").references(() => treatmentsTable.id, { onDelete: "set null" }),
  memorandumText: text("memorandum_text").notNull(),
  status: memorandumStatusEnum("status").notNull().default("pending_approval"),
  requestedById: uuid("requested_by_id").references(() => usersTable.id),
  approverId: uuid("approver_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAcceptanceMemorandumSchema = createInsertSchema(acceptanceMemorandaTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAcceptanceMemorandum = z.infer<typeof insertAcceptanceMemorandumSchema>;
export type AcceptanceMemorandum = typeof acceptanceMemorandaTable.$inferSelect;
