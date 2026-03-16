import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { vendorsTable } from "./vendors";

export const questionnaireStatusEnum = pgEnum("questionnaire_status", [
  "draft",
  "sent",
  "in_progress",
  "completed",
]);

export const questionnairesTable = pgTable("questionnaires", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id),
  title: text("title").notNull(),
  status: questionnaireStatusEnum("questionnaire_status").notNull().default("draft"),
  template: jsonb("template").default([]),
  responses: jsonb("responses").default({}),
  magicLinkToken: text("magic_link_token"),
  magicLinkExpiresAt: timestamp("magic_link_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertQuestionnaireSchema = createInsertSchema(questionnairesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestionnaire = z.infer<typeof insertQuestionnaireSchema>;
export type Questionnaire = typeof questionnairesTable.$inferSelect;
