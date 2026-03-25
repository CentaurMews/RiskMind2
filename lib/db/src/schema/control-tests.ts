import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { controlsTable } from "./controls";
import { usersTable } from "./users";

export const controlTestResultEnum = pgEnum("control_test_result", [
  "pass",
  "fail",
  "partial",
  "not_tested",
]);

export const controlTestsTable = pgTable("control_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  controlId: uuid("control_id").notNull().references(() => controlsTable.id),
  testerId: uuid("tester_id").references(() => usersTable.id),
  result: controlTestResultEnum("control_test_result").notNull().default("not_tested"),
  evidence: text("evidence"),
  evidenceUrl: text("evidence_url"),
  evidenceFileName: text("evidence_file_name"),
  evidenceMimeType: text("evidence_mime_type"),
  evidenceExpiry: timestamp("evidence_expiry", { withTimezone: true }),
  notes: text("notes"),
  testedAt: timestamp("tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertControlTestSchema = createInsertSchema(controlTestsTable).omit({ id: true, createdAt: true, updatedAt: true, evidenceFileName: true, evidenceMimeType: true });
export type InsertControlTest = z.infer<typeof insertControlTestSchema>;
export type ControlTest = typeof controlTestsTable.$inferSelect;
