import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { vendorsTable, vendorStatusEnum } from "./vendors";
import { usersTable } from "./users";

export const vendorStatusEventsTable = pgTable("vendor_status_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => usersTable.id),
  fromStatus: vendorStatusEnum("from_status").notNull(),
  toStatus: vendorStatusEnum("to_status").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type VendorStatusEvent = typeof vendorStatusEventsTable.$inferSelect;
