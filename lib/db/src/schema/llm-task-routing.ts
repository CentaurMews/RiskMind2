import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { llmConfigsTable } from "./llm-configs";

export const llmTaskRoutingTable = pgTable("llm_task_routing", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  taskType: text("task_type").notNull(),
  configId: uuid("config_id").references(() => llmConfigsTable.id, { onDelete: "set null" }),
  modelOverride: text("model_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("llm_task_routing_tenant_task_idx").on(t.tenantId, t.taskType),
]);

export type LlmTaskRouting = typeof llmTaskRoutingTable.$inferSelect;
export type InsertLlmTaskRouting = typeof llmTaskRoutingTable.$inferInsert;
