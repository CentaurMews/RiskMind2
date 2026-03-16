import { pgTable, uuid, text, timestamp, numeric, pgEnum, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const signalStatusEnum = pgEnum("signal_status", [
  "pending",
  "triaged",
  "finding",
  "dismissed",
]);

export const signalsTable = pgTable("signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  source: text("source").notNull(),
  content: text("content").notNull(),
  status: signalStatusEnum("status").notNull().default("pending"),
  classification: text("classification"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true, updatedAt: true, embedding: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
