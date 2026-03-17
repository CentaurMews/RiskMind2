import { db, pool } from "@workspace/db";
import {
  tenantsTable,
  usersTable,
  risksTable,
  vendorsTable,
  signalsTable,
  alertsTable,
  frameworksTable,
  frameworkRequirementsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { iso27001Requirements } from "./framework-data/iso27001";
import { soc2Requirements } from "./framework-data/soc2";
import { nistCsfRequirements } from "./framework-data/nist-csf";

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(password, 12);
}

async function seed() {
  console.log("Starting seed...");

  const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, "acme")).limit(1);
  if (existing.length > 0) {
    console.log("Seed data already exists (Acme Corp tenant found). Skipping.");
    await pool.end();
    return;
  }

  const [tenant] = await db.insert(tenantsTable).values({
    name: "Acme Corp",
    slug: "acme",
    settings: {},
  }).returning();

  console.log(`Created tenant: ${tenant.name} (${tenant.id})`);

  const password = await hashPassword("password123");

  const userDefs = [
    { email: "admin@acme.com", name: "Admin User", role: "admin" as const },
    { email: "riskmanager@acme.com", name: "Risk Manager", role: "risk_manager" as const },
    { email: "riskowner@acme.com", name: "Risk Owner", role: "risk_owner" as const },
    { email: "auditor@acme.com", name: "Auditor User", role: "auditor" as const },
    { email: "viewer@acme.com", name: "Viewer User", role: "viewer" as const },
    { email: "vendor@acme.com", name: "Vendor User", role: "vendor" as const },
  ];

  const users = await db.insert(usersTable).values(
    userDefs.map((u) => ({
      tenantId: tenant.id,
      email: u.email,
      name: u.name,
      role: u.role,
      hashedPassword: password,
    }))
  ).returning();

  console.log(`Created ${users.length} users`);

  const adminUser = users.find((u) => u.role === "admin")!;
  const rmUser = users.find((u) => u.role === "risk_manager")!;
  const roUser = users.find((u) => u.role === "risk_owner")!;

  const riskDefs = [
    { title: "Cloud Provider Outage", category: "technology" as const, status: "open" as const, likelihood: 3, impact: 5, ownerId: roUser.id },
    { title: "Data Breach via Third-Party", category: "technology" as const, status: "open" as const, likelihood: 2, impact: 5, ownerId: rmUser.id },
    { title: "Regulatory Non-Compliance Fine", category: "compliance" as const, status: "open" as const, likelihood: 2, impact: 4, ownerId: rmUser.id },
    { title: "Key Employee Departure", category: "operational" as const, status: "mitigated" as const, likelihood: 3, impact: 3, ownerId: roUser.id },
    { title: "Supply Chain Disruption", category: "operational" as const, status: "open" as const, likelihood: 4, impact: 4, ownerId: roUser.id },
    { title: "Fraud and Financial Misstatement", category: "financial" as const, status: "draft" as const, likelihood: 1, impact: 5, ownerId: adminUser.id },
    { title: "Reputational Damage from Social Media", category: "reputational" as const, status: "open" as const, likelihood: 3, impact: 3, ownerId: rmUser.id },
    { title: "Cyber Ransomware Attack", category: "technology" as const, status: "open" as const, likelihood: 2, impact: 5, ownerId: rmUser.id },
    { title: "Market Expansion Failure", category: "strategic" as const, status: "accepted" as const, likelihood: 3, impact: 2, ownerId: adminUser.id },
    { title: "Vendor Lock-in Dependency", category: "strategic" as const, status: "open" as const, likelihood: 4, impact: 3, ownerId: roUser.id },
  ];

  const risks = await db.insert(risksTable).values(
    riskDefs.map((r) => ({
      tenantId: tenant.id,
      title: r.title,
      description: `Risk scenario: ${r.title}. This risk requires continuous monitoring and mitigation efforts.`,
      category: r.category,
      status: r.status,
      likelihood: r.likelihood,
      impact: r.impact,
      ownerId: r.ownerId,
    }))
  ).returning();

  console.log(`Created ${risks.length} risks`);

  const vendorDefs = [
    { name: "CloudScale Inc", tier: "critical" as const, status: "monitoring" as const, category: "Infrastructure", contactEmail: "security@cloudscale.io" },
    { name: "DataGuard Pro", tier: "high" as const, status: "monitoring" as const, category: "Security", contactEmail: "vendor@dataguard.com" },
    { name: "PayFlow Systems", tier: "critical" as const, status: "monitoring" as const, category: "Payments", contactEmail: "compliance@payflow.io" },
    { name: "OfficeHub SaaS", tier: "medium" as const, status: "monitoring" as const, category: "Productivity", contactEmail: "admin@officehub.com" },
    { name: "MarketBridge Analytics", tier: "low" as const, status: "identification" as const, category: "Analytics", contactEmail: "info@marketbridge.co" },
  ];

  const vendors = await db.insert(vendorsTable).values(
    vendorDefs.map((v) => ({
      tenantId: tenant.id,
      name: v.name,
      description: `Third-party vendor: ${v.name}`,
      tier: v.tier,
      status: v.status,
      category: v.category,
      contactEmail: v.contactEmail,
      riskScore: String(Math.floor(Math.random() * 50) + 30),
    }))
  ).returning();

  console.log(`Created ${vendors.length} vendors`);

  const signalDefs = [
    { source: "SIEM", content: "Unusual login patterns detected from Eastern Europe IP range", status: "pending" as const },
    { source: "Threat Intel Feed", content: "New CVE published affecting cloud storage providers", status: "triaged" as const, classification: "technology" },
    { source: "Manual Report", content: "Vendor DataGuard Pro reported a security incident affecting their infrastructure", status: "finding" as const, classification: "third_party" },
  ];

  await db.insert(signalsTable).values(
    signalDefs.map((s) => ({
      tenantId: tenant.id,
      source: s.source,
      content: s.content,
      status: s.status,
      classification: s.classification || null,
    }))
  );

  console.log("Created 3 signals");

  await db.insert(alertsTable).values([
    {
      tenantId: tenant.id,
      type: "kri_breach",
      title: "Critical KRI Breach: System Uptime Below Threshold",
      description: "System uptime KRI has breached critical threshold of 99.5%",
      severity: "critical",
      status: "active",
      context: { kriName: "System Uptime", currentValue: 98.2, threshold: 99.5 },
    },
    {
      tenantId: tenant.id,
      type: "overdue_review",
      title: "Overdue Risk Review: Cloud Provider Outage",
      description: "Risk review for Cloud Provider Outage is 5 days past due",
      severity: "medium",
      status: "active",
      context: { riskTitle: "Cloud Provider Outage", daysPastDue: 5 },
    },
  ]);

  console.log("Created 2 alerts");

  async function seedRequirements(
    tenantId: string,
    frameworkId: string,
    requirements: { code: string; title: string; parent?: string }[],
    descPrefix: string
  ) {
    const codeToId: Record<string, string> = {};
    for (const r of requirements) {
      const [inserted] = await db.insert(frameworkRequirementsTable).values({
        tenantId,
        frameworkId,
        code: r.code,
        title: r.title,
        description: `${descPrefix}: ${r.title}`,
        parentId: r.parent ? codeToId[r.parent] || null : null,
      }).returning();
      codeToId[r.code] = inserted.id;
    }
    return Object.keys(codeToId).length;
  }

  const [isoFramework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "ISO 27001:2022",
    version: "2022",
    type: "iso",
    description: "Information security management systems — Requirements",
  }).returning();

  const isoCount = await seedRequirements(tenant.id, isoFramework.id, iso27001Requirements, "ISO 27001:2022 requirement");

  console.log(`Created ISO 27001 framework with ${isoCount} requirements`);

  const [soc2Framework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "SOC 2 Type II",
    version: "2017",
    type: "soc2",
    description: "Trust Services Criteria for Security, Availability, and Confidentiality",
  }).returning();

  const soc2Count = await seedRequirements(tenant.id, soc2Framework.id, soc2Requirements, "SOC 2 Trust Services Criteria");

  console.log(`Created SOC 2 framework with ${soc2Count} requirements`);

  const [nistFramework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "NIST CSF 2.0",
    version: "2.0",
    type: "nist",
    description: "NIST Cybersecurity Framework 2.0",
  }).returning();

  const nistCount = await seedRequirements(tenant.id, nistFramework.id, nistCsfRequirements, "NIST CSF 2.0");

  console.log(`Created NIST CSF 2.0 framework with ${nistCount} requirements`);

  console.log("\nSeed completed successfully!");
  console.log("Login credentials: any-user@acme.com / password123");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
