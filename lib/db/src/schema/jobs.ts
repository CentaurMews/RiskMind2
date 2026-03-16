import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "dead",
]);

export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id),
  queue: text("queue").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").default({}).notNull(),
  result: jsonb("result"),
  status: jobStatusEnum("job_status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Job = typeof jobsTable.$inferSelect;
