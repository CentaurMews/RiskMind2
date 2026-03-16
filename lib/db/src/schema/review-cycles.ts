import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { risksTable } from "./risks";
import { usersTable } from "./users";

export const reviewStatusEnum = pgEnum("review_status", [
  "scheduled",
  "in_progress",
  "completed",
  "overdue",
]);

export const reviewCyclesTable = pgTable("review_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  riskId: uuid("risk_id").notNull().references(() => risksTable.id),
  reviewerId: uuid("reviewer_id").references(() => usersTable.id),
  status: reviewStatusEnum("review_status").notNull().default("scheduled"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertReviewCycleSchema = createInsertSchema(reviewCyclesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReviewCycle = z.infer<typeof insertReviewCycleSchema>;
export type ReviewCycle = typeof reviewCyclesTable.$inferSelect;
