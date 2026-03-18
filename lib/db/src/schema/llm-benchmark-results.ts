import { pgTable, uuid, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { llmConfigsTable } from "./llm-configs";

export const llmBenchmarkResultsTable = pgTable("llm_benchmark_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  configId: uuid("config_id").notNull().references(() => llmConfigsTable.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  model: text("model").notNull(),
  ttftMs: integer("ttft_ms"),
  totalLatencyMs: integer("total_latency_ms").notNull(),
  qualityScore: integer("quality_score").notNull(),
  tokensPerSecond: numeric("tokens_per_second", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("llm_benchmark_config_idx").on(t.configId, t.createdAt),
  index("llm_benchmark_tenant_idx").on(t.tenantId, t.createdAt),
]);

export type LlmBenchmarkResult = typeof llmBenchmarkResultsTable.$inferSelect;
export type InsertLlmBenchmarkResult = typeof llmBenchmarkResultsTable.$inferInsert;
