import { db, usersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./password";

const DEMO_TENANT = {
  name: "Acme Corporation",
  slug: "acme",
};

const DEMO_USERS: { email: string; name: string; password: string; role: "admin" | "risk_manager" | "risk_owner" | "auditor" | "viewer" }[] = [
  { email: "admin@acme.com",       name: "Alex Admin",     password: "password123", role: "admin" },
  { email: "riskmanager@acme.com", name: "Riley Manager",  password: "password123", role: "risk_manager" },
  { email: "riskowner@acme.com",   name: "Owen Owner",     password: "password123", role: "risk_owner" },
  { email: "auditor@acme.com",     name: "Ava Auditor",    password: "password123", role: "auditor" },
  { email: "viewer@acme.com",      name: "Victor Viewer",  password: "password123", role: "viewer" },
];

export async function seedDemoDataIfEmpty(): Promise<void> {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) {
      return;
    }

    console.log("[Seed] No users found — seeding demo data...");

    const [tenant] = await db
      .insert(tenantsTable)
      .values(DEMO_TENANT)
      .onConflictDoUpdate({ target: tenantsTable.slug, set: { name: DEMO_TENANT.name } })
      .returning();

    for (const u of DEMO_USERS) {
      const hashedPassword = await hashPassword(u.password);
      await db
        .insert(usersTable)
        .values({ tenantId: tenant.id, email: u.email, name: u.name, hashedPassword, role: u.role })
        .onConflictDoNothing();
    }

    console.log(`[Seed] Done — tenant '${DEMO_TENANT.slug}' and ${DEMO_USERS.length} demo users created.`);
  } catch (err) {
    console.error("[Seed] Failed:", err);
  }
}
