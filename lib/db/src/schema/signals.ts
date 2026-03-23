import { pgTable, uuid, text, timestamp, numeric, jsonb, pgEnum, vector, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { vendorsTable } from "./vendors";

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
  contentHash: text("content_hash"),
  externalId: text("external_id"),
  vendorId: uuid("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("signals_dedup_idx")
    .on(t.tenantId, t.source, t.contentHash)
    .where(sql`content_hash IS NOT NULL`),
]);

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true, updatedAt: true, embedding: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
