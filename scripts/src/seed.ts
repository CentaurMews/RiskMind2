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
import crypto from "crypto";

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `${salt}:${key.toString("hex")}`;
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

  const password = hashPasswordSync("password123");

  const userDefs = [
    { email: "admin@acme.com", name: "Admin User", role: "admin" as const },
    { email: "riskmanager@acme.com", name: "Risk Manager", role: "risk_manager" as const },
    { email: "riskowner@acme.com", name: "Risk Owner", role: "risk_owner" as const },
    { email: "auditor@acme.com", name: "Auditor User", role: "auditor" as const },
    { email: "viewer@acme.com", name: "Viewer User", role: "viewer" as const },
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
    { name: "CloudScale Inc", tier: "critical" as const, status: "active" as const, category: "Infrastructure", contactEmail: "security@cloudscale.io" },
    { name: "DataGuard Pro", tier: "high" as const, status: "active" as const, category: "Security", contactEmail: "vendor@dataguard.com" },
    { name: "PayFlow Systems", tier: "critical" as const, status: "active" as const, category: "Payments", contactEmail: "compliance@payflow.io" },
    { name: "OfficeHub SaaS", tier: "medium" as const, status: "approved" as const, category: "Productivity", contactEmail: "admin@officehub.com" },
    { name: "MarketBridge Analytics", tier: "low" as const, status: "onboarding" as const, category: "Analytics", contactEmail: "info@marketbridge.co" },
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

  const [isoFramework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "ISO 27001:2022",
    version: "2022",
    type: "iso",
    description: "Information security management systems — Requirements",
  }).returning();

  const isoRequirements = [
    { code: "A.5", title: "Organizational controls" },
    { code: "A.5.1", title: "Policies for information security" },
    { code: "A.5.2", title: "Information security roles and responsibilities" },
    { code: "A.5.3", title: "Segregation of duties" },
    { code: "A.5.4", title: "Management responsibilities" },
    { code: "A.5.5", title: "Contact with authorities" },
    { code: "A.5.6", title: "Contact with special interest groups" },
    { code: "A.5.7", title: "Threat intelligence" },
    { code: "A.5.8", title: "Information security in project management" },
    { code: "A.6", title: "People controls" },
    { code: "A.6.1", title: "Screening" },
    { code: "A.6.2", title: "Terms and conditions of employment" },
    { code: "A.6.3", title: "Information security awareness, education and training" },
    { code: "A.7", title: "Physical controls" },
    { code: "A.7.1", title: "Physical security perimeters" },
    { code: "A.7.2", title: "Physical entry" },
    { code: "A.8", title: "Technological controls" },
    { code: "A.8.1", title: "User endpoint devices" },
    { code: "A.8.2", title: "Privileged access rights" },
    { code: "A.8.3", title: "Information access restriction" },
    { code: "A.8.4", title: "Access to source code" },
    { code: "A.8.5", title: "Secure authentication" },
    { code: "A.8.6", title: "Capacity management" },
    { code: "A.8.7", title: "Protection against malware" },
    { code: "A.8.8", title: "Management of technical vulnerabilities" },
  ];

  await db.insert(frameworkRequirementsTable).values(
    isoRequirements.map((r) => ({
      tenantId: tenant.id,
      frameworkId: isoFramework.id,
      code: r.code,
      title: r.title,
      description: `ISO 27001:2022 requirement: ${r.title}`,
    }))
  );

  console.log(`Created ISO 27001 framework with ${isoRequirements.length} requirements`);

  const [soc2Framework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "SOC 2 Type II",
    version: "2017",
    type: "soc2",
    description: "Trust Services Criteria for Security, Availability, and Confidentiality",
  }).returning();

  const soc2Requirements = [
    { code: "CC1", title: "Control Environment" },
    { code: "CC1.1", title: "COSO Principle 1: Integrity and Ethical Values" },
    { code: "CC1.2", title: "COSO Principle 2: Board Independence" },
    { code: "CC1.3", title: "COSO Principle 3: Management Structure" },
    { code: "CC2", title: "Communication and Information" },
    { code: "CC2.1", title: "COSO Principle 13: Quality Information" },
    { code: "CC2.2", title: "COSO Principle 14: Internal Communication" },
    { code: "CC2.3", title: "COSO Principle 15: External Communication" },
    { code: "CC3", title: "Risk Assessment" },
    { code: "CC3.1", title: "COSO Principle 6: Risk Assessment Objectives" },
    { code: "CC3.2", title: "COSO Principle 7: Risk Identification and Analysis" },
    { code: "CC4", title: "Monitoring Activities" },
    { code: "CC4.1", title: "COSO Principle 16: Ongoing Monitoring" },
    { code: "CC4.2", title: "COSO Principle 17: Evaluation and Communication" },
    { code: "CC5", title: "Control Activities" },
    { code: "CC5.1", title: "COSO Principle 10: Risk Mitigation" },
    { code: "CC5.2", title: "COSO Principle 11: Technology Controls" },
    { code: "CC6", title: "Logical and Physical Access Controls" },
    { code: "CC6.1", title: "Logical Access Security" },
    { code: "CC6.2", title: "Access Authentication" },
    { code: "CC6.3", title: "Access Authorization" },
    { code: "CC7", title: "System Operations" },
    { code: "CC7.1", title: "Infrastructure Monitoring" },
    { code: "CC7.2", title: "Incident Detection" },
    { code: "A1", title: "Availability" },
    { code: "A1.1", title: "Recovery from Disruptions" },
    { code: "C1", title: "Confidentiality" },
    { code: "C1.1", title: "Confidential Information Identification" },
    { code: "C1.2", title: "Confidential Information Disposal" },
  ];

  await db.insert(frameworkRequirementsTable).values(
    soc2Requirements.map((r) => ({
      tenantId: tenant.id,
      frameworkId: soc2Framework.id,
      code: r.code,
      title: r.title,
      description: `SOC 2 Trust Services Criteria: ${r.title}`,
    }))
  );

  console.log(`Created SOC 2 framework with ${soc2Requirements.length} requirements`);

  const [nistFramework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "NIST CSF 2.0",
    version: "2.0",
    type: "nist",
    description: "NIST Cybersecurity Framework 2.0",
  }).returning();

  const nistRequirements = [
    { code: "GV", title: "Govern" },
    { code: "GV.OC", title: "Organizational Context" },
    { code: "GV.RM", title: "Risk Management Strategy" },
    { code: "GV.RR", title: "Roles, Responsibilities, and Authorities" },
    { code: "GV.PO", title: "Policy" },
    { code: "GV.SC", title: "Supply Chain Risk Management" },
    { code: "ID", title: "Identify" },
    { code: "ID.AM", title: "Asset Management" },
    { code: "ID.RA", title: "Risk Assessment" },
    { code: "ID.IM", title: "Improvement" },
    { code: "PR", title: "Protect" },
    { code: "PR.AA", title: "Identity Management, Authentication, and Access Control" },
    { code: "PR.AT", title: "Awareness and Training" },
    { code: "PR.DS", title: "Data Security" },
    { code: "PR.PS", title: "Platform Security" },
    { code: "PR.IR", title: "Technology Infrastructure Resilience" },
    { code: "DE", title: "Detect" },
    { code: "DE.CM", title: "Continuous Monitoring" },
    { code: "DE.AE", title: "Adverse Event Analysis" },
    { code: "RS", title: "Respond" },
    { code: "RS.MA", title: "Incident Management" },
    { code: "RS.AN", title: "Incident Analysis" },
    { code: "RS.CO", title: "Incident Response Reporting and Communication" },
    { code: "RS.MI", title: "Incident Mitigation" },
    { code: "RC", title: "Recover" },
    { code: "RC.RP", title: "Incident Recovery Plan Execution" },
    { code: "RC.CO", title: "Incident Recovery Communication" },
  ];

  await db.insert(frameworkRequirementsTable).values(
    nistRequirements.map((r) => ({
      tenantId: tenant.id,
      frameworkId: nistFramework.id,
      code: r.code,
      title: r.title,
      description: `NIST CSF 2.0: ${r.title}`,
    }))
  );

  console.log(`Created NIST CSF 2.0 framework with ${nistRequirements.length} requirements`);

  console.log("\nSeed completed successfully!");
  console.log("Login credentials: any-user@acme.com / password123");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
