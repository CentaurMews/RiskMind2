import { pgTable, uuid, text, timestamp, jsonb, integer, numeric, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { risksTable } from "./risks";

export const foresightSimulationStatusEnum = pgEnum("foresight_simulation_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const foresightScenariosTable = pgTable("foresight_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  riskId: uuid("risk_id").references(() => risksTable.id, { onDelete: "set null" }),
  parameters: jsonb("parameters").notNull().default({}),
  calibratedFrom: text("calibrated_from"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("foresight_scenarios_tenant_idx").on(t.tenantId, t.createdAt),
]);

export const foresightSimulationsTable = pgTable("foresight_simulations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  scenarioId: uuid("scenario_id").notNull().references(() => foresightScenariosTable.id, { onDelete: "cascade" }),
  status: foresightSimulationStatusEnum("simulation_status").notNull().default("pending"),
  iterationCount: integer("iteration_count").notNull().default(10000),
  results: jsonb("results"),
  inputParameters: jsonb("input_parameters").notNull().default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("foresight_simulations_tenant_idx").on(t.tenantId, t.scenarioId),
]);

export const insertForesightScenarioSchema = createInsertSchema(foresightScenariosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertForesightScenario = z.infer<typeof insertForesightScenarioSchema>;
export type ForesightScenario = typeof foresightScenariosTable.$inferSelect;

export const insertForesightSimulationSchema = createInsertSchema(foresightSimulationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertForesightSimulation = z.infer<typeof insertForesightSimulationSchema>;
export type ForesightSimulation = typeof foresightSimulationsTable.$inferSelect;
