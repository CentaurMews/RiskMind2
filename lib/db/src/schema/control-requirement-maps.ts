import { pgTable, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { controlsTable } from "./controls";
import { frameworkRequirementsTable } from "./framework-requirements";

export const controlRequirementMapsTable = pgTable("control_requirement_maps", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  controlId: uuid("control_id").notNull().references(() => controlsTable.id),
  requirementId: uuid("requirement_id").notNull().references(() => frameworkRequirementsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ControlRequirementMap = typeof controlRequirementMapsTable.$inferSelect;
