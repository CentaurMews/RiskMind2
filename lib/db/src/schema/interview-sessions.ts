import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const interviewTypeEnum = pgEnum("interview_type", [
  "risk_creation",
  "control_assessment",
]);

export const interviewStatusEnum = pgEnum("interview_status", [
  "active",
  "committed",
  "abandoned",
]);

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  type: interviewTypeEnum("type").notNull(),
  status: interviewStatusEnum("status").notNull().default("active"),
  transcript: jsonb("transcript").default([]).notNull(),
  draftData: jsonb("draft_data").default({}).notNull(),
  resultId: uuid("result_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
