import { pgTable, uuid, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const llmProviderTypeEnum = pgEnum("llm_provider_type", [
  "openai_compat",
  "anthropic",
]);

export const llmUseCaseEnum = pgEnum("llm_use_case", [
  "general",
  "embeddings",
]);

export const llmConfigsTable = pgTable("llm_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  providerType: llmProviderTypeEnum("provider_type").notNull(),
  baseUrl: text("base_url"),
  encryptedApiKey: text("encrypted_api_key"),
  model: text("model").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  useCase: llmUseCaseEnum("use_case").notNull().default("general"),
  displayProvider: text("display_provider"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLlmConfigSchema = createInsertSchema(llmConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLlmConfig = z.infer<typeof insertLlmConfigSchema>;
export type LlmConfig = typeof llmConfigsTable.$inferSelect;
