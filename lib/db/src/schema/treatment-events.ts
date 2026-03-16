import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { treatmentsTable, treatmentStatusEnum } from "./treatments";
import { usersTable } from "./users";
import { tenantsTable } from "./tenants";

export const treatmentStatusEventsTable = pgTable("treatment_status_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  treatmentId: uuid("treatment_id").notNull().references(() => treatmentsTable.id, { onDelete: "cascade" }),
  fromStatus: treatmentStatusEnum("from_status"),
  toStatus: treatmentStatusEnum("to_status").notNull(),
  changedBy: uuid("changed_by").references(() => usersTable.id),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TreatmentStatusEvent = typeof treatmentStatusEventsTable.$inferSelect;
