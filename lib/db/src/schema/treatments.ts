import { pgTable, uuid, text, timestamp, numeric, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { risksTable } from "./risks";
import { usersTable } from "./users";

export const treatmentStrategyEnum = pgEnum("treatment_strategy", [
  "treat",
  "transfer",
  "tolerate",
  "terminate",
]);

export const treatmentStatusEnum = pgEnum("treatment_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const treatmentsTable = pgTable("treatments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  riskId: uuid("risk_id").notNull().references(() => risksTable.id),
  strategy: treatmentStrategyEnum("strategy").notNull(),
  description: text("description"),
  status: treatmentStatusEnum("status").notNull().default("planned"),
  ownerId: uuid("owner_id").references(() => usersTable.id),
  dueDate: timestamp("due_date", { withTimezone: true }),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  benefit: numeric("benefit", { precision: 12, scale: 2 }),
  effectivenessScore: integer("effectiveness_score"),
  progressNotes: text("progress_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTreatmentSchema = createInsertSchema(treatmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTreatment = z.infer<typeof insertTreatmentSchema>;
export type Treatment = typeof treatmentsTable.$inferSelect;
