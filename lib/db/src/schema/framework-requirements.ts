import { pgTable, uuid, text, timestamp, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { frameworksTable } from "./frameworks";

export const frameworkRequirementsTable = pgTable("framework_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  frameworkId: uuid("framework_id").notNull().references(() => frameworksTable.id),
  parentId: uuid("parent_id"),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFrameworkRequirementSchema = createInsertSchema(frameworkRequirementsTable).omit({ id: true, createdAt: true, updatedAt: true, embedding: true });
export type InsertFrameworkRequirement = z.infer<typeof insertFrameworkRequirementSchema>;
export type FrameworkRequirement = typeof frameworkRequirementsTable.$inferSelect;
