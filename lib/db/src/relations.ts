import { relations } from "drizzle-orm";
import { assessmentTemplatesTable, assessmentsTable } from "./schema/assessments";
import { integrationConfigsTable } from "./schema/integration-configs";
import { foresightScenariosTable, foresightSimulationsTable } from "./schema/foresight";
import { vendorSubprocessorsTable } from "./schema/vendor-subprocessors";
import { orgDependenciesTable } from "./schema/org-dependencies";
import { monitoringConfigsTable } from "./schema/monitoring-configs";
import { tenantsTable } from "./schema/tenants";
import { vendorsTable } from "./schema/vendors";
import { risksTable } from "./schema/risks";

export const assessmentTemplateRelations = relations(assessmentTemplatesTable, ({ one, many }) => ({
  tenant: one(tenantsTable, {
    fields: [assessmentTemplatesTable.tenantId],
    references: [tenantsTable.id],
  }),
  assessments: many(assessmentsTable),
}));

export const assessmentRelations = relations(assessmentsTable, ({ one }) => ({
  tenant: one(tenantsTable, {
    fields: [assessmentsTable.tenantId],
    references: [tenantsTable.id],
  }),
  template: one(assessmentTemplatesTable, {
    fields: [assessmentsTable.templateId],
    references: [assessmentTemplatesTable.id],
  }),
}));

export const integrationConfigRelations = relations(integrationConfigsTable, ({ one }) => ({
  tenant: one(tenantsTable, {
    fields: [integrationConfigsTable.tenantId],
    references: [tenantsTable.id],
  }),
}));

export const foresightScenarioRelations = relations(foresightScenariosTable, ({ one, many }) => ({
  tenant: one(tenantsTable, {
    fields: [foresightScenariosTable.tenantId],
    references: [tenantsTable.id],
  }),
  risk: one(risksTable, {
    fields: [foresightScenariosTable.riskId],
    references: [risksTable.id],
  }),
  simulations: many(foresightSimulationsTable),
}));

export const foresightSimulationRelations = relations(foresightSimulationsTable, ({ one }) => ({
  tenant: one(tenantsTable, {
    fields: [foresightSimulationsTable.tenantId],
    references: [tenantsTable.id],
  }),
  scenario: one(foresightScenariosTable, {
    fields: [foresightSimulationsTable.scenarioId],
    references: [foresightScenariosTable.id],
  }),
}));

export const vendorSubprocessorRelations = relations(vendorSubprocessorsTable, ({ one }) => ({
  tenant: one(tenantsTable, {
    fields: [vendorSubprocessorsTable.tenantId],
    references: [tenantsTable.id],
  }),
  vendor: one(vendorsTable, {
    fields: [vendorSubprocessorsTable.vendorId],
    references: [vendorsTable.id],
    relationName: "vendorToSubprocessors",
  }),
  subprocessor: one(vendorsTable, {
    fields: [vendorSubprocessorsTable.subprocessorId],
    references: [vendorsTable.id],
    relationName: "subprocessorToVendors",
  }),
}));

export const orgDependencyRelations = relations(orgDependenciesTable, ({ one }) => ({
  tenant: one(tenantsTable, {
    fields: [orgDependenciesTable.tenantId],
    references: [tenantsTable.id],
  }),
  vendor: one(vendorsTable, {
    fields: [orgDependenciesTable.vendorId],
    references: [vendorsTable.id],
  }),
}));

export const monitoringConfigRelations = relations(monitoringConfigsTable, ({ one }) => ({
  tenant: one(tenantsTable, {
    fields: [monitoringConfigsTable.tenantId],
    references: [tenantsTable.id],
  }),
  assessmentTemplate: one(assessmentTemplatesTable, {
    fields: [monitoringConfigsTable.assessmentTemplateId],
    references: [assessmentTemplatesTable.id],
  }),
}));
