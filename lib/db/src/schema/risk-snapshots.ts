import { pgTable, uuid, integer, numeric, jsonb, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const riskSnapshotsTable = pgTable("risk_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  snapshotDate: date("snapshot_date").notNull(),
  compositeScore: numeric("composite_score", { precision: 6, scale: 2 }).notNull(),
  totalRisks: integer("total_risks").notNull(),
  aboveAppetiteCount: integer("above_appetite_count").notNull().default(0),
  // keyed by "likelihood-impact" e.g. {"3-4": 5}
  cellCounts: jsonb("cell_counts").notNull().default({}),
  // e.g. {"technology": {"score": 72, "count": 8, "highCriticalCount": 3}}
  categoryCounts: jsonb("category_counts").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("risk_snapshots_tenant_date_idx").on(t.tenantId, t.snapshotDate),
]);

export const insertRiskSnapshotSchema = createInsertSchema(riskSnapshotsTable).omit({ id: true, createdAt: true });
export type InsertRiskSnapshot = z.infer<typeof insertRiskSnapshotSchema>;
export type RiskSnapshot = typeof riskSnapshotsTable.$inferSelect;
