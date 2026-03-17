import { pgTable, uuid, text, timestamp, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const answerTypeEnum = pgEnum("answer_type", [
  "text",
  "boolean",
  "scale",
]);

export const questionCategoryEnum = pgEnum("question_category", [
  "security",
  "privacy",
  "operational",
  "technology",
  "financial_services",
  "healthcare",
  "retail",
  "logistics",
  "general",
]);

export const questionnaireQuestionsTable = pgTable("questionnaire_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id),
  text: text("text").notNull(),
  category: questionCategoryEnum("category").notNull().default("general"),
  answerType: answerTypeEnum("answer_type").notNull().default("text"),
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("1.00"),
  isCore: boolean("is_core").notNull().default(false),
  vendorCategory: text("vendor_category"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertQuestionnaireQuestionSchema = createInsertSchema(questionnaireQuestionsTable).omit({ id: true, createdAt: true });
export type InsertQuestionnaireQuestion = z.infer<typeof insertQuestionnaireQuestionSchema>;
export type QuestionnaireQuestion = typeof questionnaireQuestionsTable.$inferSelect;
