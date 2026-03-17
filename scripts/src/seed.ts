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
  treatmentsTable,
  controlsTable,
  controlRequirementMapsTable,
  krisTable,
  incidentsTable,
  questionnairesTable,
  questionnaireQuestionsTable,
  agentRunsTable,
  agentFindingsTable,
  reviewCyclesTable,
  acceptanceMemorandaTable,
  auditEventsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { iso27001Requirements } from "./framework-data/iso27001";
import { soc2Requirements } from "./framework-data/soc2";
import { nistCsfRequirements } from "./framework-data/nist-csf";

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(password, 12);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
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
    { email: "admin@acme.com", name: "Alex Admin", role: "admin" as const },
    { email: "riskmanager@acme.com", name: "Riley Manager", role: "risk_manager" as const },
    { email: "riskowner@acme.com", name: "Owen Owner", role: "risk_owner" as const },
    { email: "auditor@acme.com", name: "Ava Auditor", role: "auditor" as const },
    { email: "viewer@acme.com", name: "Victor Viewer", role: "viewer" as const },
    { email: "vendor@acme.com", name: "Vendor User", role: "vendor" as const },
    { email: "riskexec@acme.com", name: "Executive Reed", role: "risk_executive" as const },
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
  const execUser = users.find((u) => u.role === "risk_executive")!;

  // Task 1: Enrich risks with meaningful descriptions, residual and target scores
  const riskDefs = [
    {
      title: "Cloud Provider Outage",
      category: "technology" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 5,
      residualLikelihood: 2,
      residualImpact: 4,
      targetLikelihood: 1,
      targetImpact: 3,
      ownerId: roUser.id,
      description: "A prolonged outage of our primary cloud infrastructure provider (AWS us-east-1) could render all production services unavailable. With approximately 97% of our workloads hosted in the cloud, any major disruption lasting more than 4 hours would breach SLA commitments with enterprise customers. The risk is elevated due to our current single-region deployment architecture.",
    },
    {
      title: "Data Breach via Third-Party",
      category: "technology" as const,
      status: "open" as const,
      likelihood: 2,
      impact: 5,
      residualLikelihood: 2,
      residualImpact: 4,
      targetLikelihood: 1,
      targetImpact: 3,
      ownerId: rmUser.id,
      description: "A security breach originating from one of our critical third-party vendors could expose customer PII and financial data. Our most critical vendors handle sensitive data including payment processing and customer analytics. A breach of this nature could trigger GDPR notification obligations, regulatory fines, and significant customer churn. Recent threat intelligence indicates increased targeting of SaaS supply chains.",
    },
    {
      title: "Regulatory Non-Compliance Fine",
      category: "compliance" as const,
      status: "open" as const,
      likelihood: 2,
      impact: 4,
      residualLikelihood: 2,
      residualImpact: 3,
      targetLikelihood: 1,
      targetImpact: 2,
      ownerId: rmUser.id,
      description: "Failure to maintain compliance with GDPR, SOC 2 Type II, and emerging EU AI Act requirements could result in regulatory fines up to 4% of annual global turnover. Our current compliance program has gaps in automated evidence collection, vendor due diligence documentation, and data retention enforcement. Two upcoming regulatory audits in Q3 increase the likelihood of exposure.",
    },
    {
      title: "Key Employee Departure",
      category: "operational" as const,
      status: "mitigated" as const,
      likelihood: 3,
      impact: 3,
      residualLikelihood: 2,
      residualImpact: 2,
      targetLikelihood: 2,
      targetImpact: 2,
      ownerId: roUser.id,
      description: "The unexpected departure of key personnel in critical roles (Lead Security Engineer, Principal Architect, VP Engineering) could result in significant knowledge loss and operational disruption. Succession planning documentation is incomplete for 6 of 12 critical positions. A competitive talent market in the cloud security space heightens this risk. Mitigation includes cross-training initiatives and improved documentation practices now underway.",
    },
    {
      title: "Supply Chain Disruption",
      category: "operational" as const,
      status: "open" as const,
      likelihood: 4,
      impact: 4,
      residualLikelihood: 3,
      residualImpact: 3,
      targetLikelihood: 2,
      targetImpact: 3,
      ownerId: roUser.id,
      description: "Disruption to our software and hardware supply chain could delay product delivery and impact service reliability. Our development pipeline depends on 47 third-party libraries and 3 specialized hardware vendors for on-premises customer installations. Geopolitical tensions affecting semiconductor supply and recent open-source library compromises (SolarWinds-style attacks) elevate this risk considerably.",
    },
    {
      title: "Fraud and Financial Misstatement",
      category: "financial" as const,
      status: "accepted" as const,
      likelihood: 1,
      impact: 5,
      residualLikelihood: 1,
      residualImpact: 4,
      targetLikelihood: 1,
      targetImpact: 3,
      ownerId: adminUser.id,
      description: "Internal or external fraud resulting in financial misstatement could damage investor confidence and trigger SEC enforcement actions. Identified scenarios include unauthorized wire transfers, revenue recognition manipulation, and expense reimbursement fraud. While controls exist, a recent internal audit identified gaps in segregation of duties within the Finance team and insufficient monitoring of privileged access to financial systems. The Risk Committee has accepted the residual risk pending full PAM deployment in Q2 2026.",
    },
    {
      title: "Reputational Damage from Social Media",
      category: "reputational" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 3,
      residualLikelihood: 2,
      residualImpact: 3,
      targetLikelihood: 2,
      targetImpact: 2,
      ownerId: rmUser.id,
      description: "Negative social media campaigns or viral incidents related to a product outage, data privacy controversy, or customer service failure could significantly impact brand perception and customer acquisition. Our brand monitoring capabilities are currently limited to reactive response. A single high-profile incident could reduce new customer conversion by an estimated 15-25% based on industry benchmarks.",
    },
    {
      title: "Cyber Ransomware Attack",
      category: "technology" as const,
      status: "open" as const,
      likelihood: 2,
      impact: 5,
      residualLikelihood: 2,
      residualImpact: 4,
      targetLikelihood: 1,
      targetImpact: 3,
      ownerId: rmUser.id,
      description: "A successful ransomware attack could encrypt critical production systems and exfiltrate sensitive customer data, leading to extended downtime and potential double extortion. Threat intelligence indicates Acme Corp was mentioned in a dark web forum as a potential target due to its acquisition of a healthcare analytics startup. Current endpoint detection coverage is at 94%, leaving 6% of devices unprotected. Backup systems have not been tested for full recovery in 14 months.",
    },
    {
      title: "Market Expansion Failure",
      category: "strategic" as const,
      status: "accepted" as const,
      likelihood: 3,
      impact: 2,
      residualLikelihood: 3,
      residualImpact: 2,
      targetLikelihood: 2,
      targetImpact: 2,
      ownerId: adminUser.id,
      description: "The planned expansion into the APAC market may fail to achieve projected revenue targets due to regulatory barriers, cultural product-market fit issues, and intensified local competition. Initial market research indicates a 35% lower willingness-to-pay among target segments. The Board has formally accepted this risk given the strategic importance of geographic diversification and approved a 24-month runway to reach breakeven. A formal acceptance memorandum has been documented.",
    },
    {
      title: "Vendor Lock-in Dependency",
      category: "strategic" as const,
      status: "open" as const,
      likelihood: 4,
      impact: 3,
      residualLikelihood: 3,
      residualImpact: 3,
      targetLikelihood: 2,
      targetImpact: 2,
      ownerId: roUser.id,
      description: "Excessive dependency on a single cloud provider's proprietary services (AWS Lambda, DynamoDB, SageMaker) creates strategic lock-in that limits negotiating leverage and increases migration risk. Estimated cost to migrate to a multi-cloud architecture is $2.3M and 18 months of engineering effort. Current proprietary API usage has grown 40% year-over-year, deepening the dependency. Containerization efforts are underway but moving slowly.",
    },
  ];

  const risks = await db.insert(risksTable).values(
    riskDefs.map((r) => ({
      tenantId: tenant.id,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      likelihood: r.likelihood,
      impact: r.impact,
      residualLikelihood: r.residualLikelihood,
      residualImpact: r.residualImpact,
      targetLikelihood: r.targetLikelihood,
      targetImpact: r.targetImpact,
      ownerId: r.ownerId,
    }))
  ).returning();

  console.log(`Created ${risks.length} risks`);

  const riskByTitle = Object.fromEntries(risks.map((r) => [r.title, r]));

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

  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v]));

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

  // Task 2: Seed 15 treatments across 10 risks
  const treatmentDefs = [
    {
      riskTitle: "Cloud Provider Outage",
      strategy: "treat" as const,
      status: "in_progress" as const,
      description: "Implement multi-region active-active deployment across AWS us-east-1 and us-west-2 to eliminate single region as a point of failure.",
      cost: "85000.00",
      benefit: "500000.00",
      ownerId: roUser.id,
      dueDate: daysFromNow(60),
    },
    {
      riskTitle: "Cloud Provider Outage",
      strategy: "transfer" as const,
      status: "completed" as const,
      description: "Procure business interruption cyber insurance policy covering cloud outage events with minimum $2M coverage per incident.",
      cost: "24000.00",
      benefit: "2000000.00",
      ownerId: adminUser.id,
      dueDate: daysAgo(30),
    },
    {
      riskTitle: "Data Breach via Third-Party",
      strategy: "treat" as const,
      status: "in_progress" as const,
      description: "Deploy Data Loss Prevention (DLP) controls on all integrations with critical third-party vendors and enforce zero-trust network segmentation for vendor API access.",
      cost: "45000.00",
      benefit: "1000000.00",
      ownerId: rmUser.id,
      dueDate: daysFromNow(45),
    },
    {
      riskTitle: "Data Breach via Third-Party",
      strategy: "treat" as const,
      status: "planned" as const,
      description: "Implement mandatory annual security assessments and penetration testing requirements in all critical vendor contracts with right-to-audit clauses.",
      cost: "30000.00",
      benefit: "800000.00",
      ownerId: rmUser.id,
      dueDate: daysFromNow(90),
    },
    {
      riskTitle: "Regulatory Non-Compliance Fine",
      strategy: "treat" as const,
      status: "in_progress" as const,
      description: "Build automated compliance evidence collection pipeline integrated with SOC 2 Type II controls framework. Automate control testing schedules and evidence capture.",
      cost: "65000.00",
      benefit: "400000.00",
      ownerId: rmUser.id,
      dueDate: daysFromNow(120),
    },
    {
      riskTitle: "Key Employee Departure",
      strategy: "treat" as const,
      status: "completed" as const,
      description: "Implement comprehensive knowledge management program including runbooks, architecture decision records, and mandatory cross-training for all critical roles. Completed for 10 of 12 critical positions.",
      cost: "18000.00",
      benefit: "250000.00",
      ownerId: roUser.id,
      dueDate: daysAgo(15),
    },
    {
      riskTitle: "Supply Chain Disruption",
      strategy: "treat" as const,
      status: "planned" as const,
      description: "Identify and qualify alternative suppliers for all single-source hardware and software dependencies. Maintain strategic inventory buffer for critical hardware components.",
      cost: "40000.00",
      benefit: "600000.00",
      ownerId: roUser.id,
      dueDate: daysFromNow(75),
    },
    {
      riskTitle: "Supply Chain Disruption",
      strategy: "transfer" as const,
      status: "planned" as const,
      description: "Expand supply chain insurance coverage to include software library compromise events and vendor insolvency scenarios.",
      cost: "12000.00",
      benefit: "300000.00",
      ownerId: adminUser.id,
      dueDate: daysFromNow(30),
    },
    {
      riskTitle: "Fraud and Financial Misstatement",
      strategy: "treat" as const,
      status: "planned" as const,
      description: "Remediate segregation of duties gaps in Finance team by implementing four-eyes approval for all transactions above $10,000 and deploying financial monitoring SIEM rules.",
      cost: "20000.00",
      benefit: "2000000.00",
      ownerId: adminUser.id,
      dueDate: daysFromNow(50),
    },
    {
      riskTitle: "Cyber Ransomware Attack",
      strategy: "treat" as const,
      status: "in_progress" as const,
      description: "Expand EDR coverage to 100% of endpoints, implement immutable backup strategy with 3-2-1 rule, and conduct quarterly ransomware tabletop exercises.",
      cost: "95000.00",
      benefit: "3000000.00",
      ownerId: rmUser.id,
      dueDate: daysFromNow(30),
    },
    {
      riskTitle: "Cyber Ransomware Attack",
      strategy: "transfer" as const,
      status: "completed" as const,
      description: "Secured cyber liability insurance policy with $5M ransomware coverage and pre-negotiated incident response retainer.",
      cost: "48000.00",
      benefit: "5000000.00",
      ownerId: adminUser.id,
      dueDate: daysAgo(45),
    },
    {
      riskTitle: "Market Expansion Failure",
      strategy: "tolerate" as const,
      status: "completed" as const,
      description: "Board formally accepted the market expansion risk as strategically necessary. Risk acceptance memorandum signed with 24-month review trigger. Quarterly KPI monitoring established.",
      cost: "5000.00",
      benefit: "0.00",
      ownerId: adminUser.id,
      dueDate: daysAgo(10),
    },
    {
      riskTitle: "Vendor Lock-in Dependency",
      strategy: "treat" as const,
      status: "in_progress" as const,
      description: "Containerize remaining proprietary AWS service dependencies using abstraction layers. Target: reduce proprietary API calls by 40% within 18 months.",
      cost: "120000.00",
      benefit: "800000.00",
      ownerId: roUser.id,
      dueDate: daysFromNow(180),
    },
    {
      riskTitle: "Reputational Damage from Social Media",
      strategy: "treat" as const,
      status: "planned" as const,
      description: "Deploy 24/7 brand monitoring platform with automated alerting, establish crisis communications playbook, and retain PR firm on standing retainer.",
      cost: "35000.00",
      benefit: "500000.00",
      ownerId: rmUser.id,
      dueDate: daysFromNow(60),
    },
    {
      riskTitle: "Reputational Damage from Social Media",
      strategy: "tolerate" as const,
      status: "cancelled" as const,
      description: "Originally proposed: engage social media influencers proactively. Cancelled — determined to be outside risk management scope and moved to Marketing.",
      cost: "0.00",
      benefit: "0.00",
      ownerId: rmUser.id,
      dueDate: daysAgo(60),
    },
    {
      riskTitle: "Fraud and Financial Misstatement",
      strategy: "terminate" as const,
      status: "completed" as const,
      description: "Terminate the use of shared service account credentials for financial system access. All personnel must use individual named accounts with MFA enforced. Shared credentials have been revoked and the wiki documentation purged.",
      cost: "5000.00",
      benefit: "150000.00",
      ownerId: adminUser.id,
      dueDate: daysAgo(7),
    },
  ];

  const treatments = await db.insert(treatmentsTable).values(
    treatmentDefs.map((t) => ({
      tenantId: tenant.id,
      riskId: riskByTitle[t.riskTitle].id,
      strategy: t.strategy,
      status: t.status,
      description: t.description,
      cost: t.cost,
      benefit: t.benefit,
      ownerId: t.ownerId,
      dueDate: t.dueDate,
    }))
  ).returning();

  console.log(`Created ${treatments.length} treatments`);

  // Frameworks
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
    return codeToId;
  }

  const [isoFramework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "ISO 27001:2022",
    version: "2022",
    type: "iso",
    description: "Information security management systems — Requirements",
  }).returning();

  const isoCodes = await seedRequirements(tenant.id, isoFramework.id, iso27001Requirements, "ISO 27001:2022 requirement");
  console.log(`Created ISO 27001 framework with ${Object.keys(isoCodes).length} requirements`);

  const [soc2Framework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "SOC 2 Type II",
    version: "2017",
    type: "soc2",
    description: "Trust Services Criteria for Security, Availability, and Confidentiality",
  }).returning();

  const soc2Codes = await seedRequirements(tenant.id, soc2Framework.id, soc2Requirements, "SOC 2 Trust Services Criteria");
  console.log(`Created SOC 2 framework with ${Object.keys(soc2Codes).length} requirements`);

  const [nistFramework] = await db.insert(frameworksTable).values({
    tenantId: tenant.id,
    name: "NIST CSF 2.0",
    version: "2.0",
    type: "nist",
    description: "NIST Cybersecurity Framework 2.0",
  }).returning();

  const nistCodes = await seedRequirements(tenant.id, nistFramework.id, nistCsfRequirements, "NIST CSF 2.0");
  console.log(`Created NIST CSF 2.0 framework with ${Object.keys(nistCodes).length} requirements`);

  // Task 3: Seed 12 controls and map to framework requirements
  const controlDefs = [
    {
      title: "Multi-Factor Authentication (MFA)",
      description: "Enforce MFA for all user accounts accessing production systems, admin consoles, and cloud management interfaces. MFA is required for VPN access, SSO, and privileged account access.",
      status: "active" as const,
      ownerId: rmUser.id,
    },
    {
      title: "Data Loss Prevention (DLP)",
      description: "Deploy DLP controls across email, cloud storage, and API endpoints to detect and prevent unauthorized exfiltration of sensitive data including PII and financial records.",
      status: "active" as const,
      ownerId: rmUser.id,
    },
    {
      title: "Incident Response Plan",
      description: "Maintain and test a comprehensive incident response plan covering detection, containment, eradication, recovery, and post-incident review phases. Plan reviewed annually and after major incidents.",
      status: "active" as const,
      ownerId: rmUser.id,
    },
    {
      title: "Patch Management",
      description: "Apply security patches within defined SLAs: critical vulnerabilities within 24 hours, high within 7 days, medium within 30 days. Automated scanning detects missing patches across all environments.",
      status: "active" as const,
      ownerId: roUser.id,
    },
    {
      title: "Vendor Security Review",
      description: "Conduct annual security assessments for all critical and high-tier vendors including questionnaire completion, evidence review, and right-to-audit clause enforcement.",
      status: "active" as const,
      ownerId: rmUser.id,
    },
    {
      title: "Business Continuity Plan",
      description: "Maintain BCP covering all critical business functions with defined RTO and RPO targets. BCP tested via tabletop exercise annually and full simulation every two years. Current BCP is undergoing a full revision to incorporate cloud-native recovery procedures; the updated plan is planned for approval in Q2 2026.",
      status: "planned" as const,
      ownerId: adminUser.id,
    },
    {
      title: "Encryption at Rest",
      description: "Enforce AES-256 encryption for all data at rest including database storage, backup archives, and file storage. Encryption keys managed via AWS KMS with quarterly rotation.",
      status: "active" as const,
      ownerId: roUser.id,
    },
    {
      title: "Access Control Policy",
      description: "Implement and enforce least-privilege access control policy. All access requests require manager approval and quarterly access reviews are conducted to identify and revoke excessive permissions.",
      status: "active" as const,
      ownerId: rmUser.id,
    },
    {
      title: "Vulnerability Scanning",
      description: "Run automated vulnerability scans against all internet-facing and internal systems weekly. Critical findings escalated to security team within 4 hours. Full pentest conducted annually.",
      status: "active" as const,
      ownerId: roUser.id,
    },
    {
      title: "Security Awareness Training",
      description: "Deliver mandatory annual security awareness training to all employees. Monthly phishing simulations conducted with targeted remediation training for employees who fail simulations.",
      status: "active" as const,
      ownerId: rmUser.id,
    },
    {
      title: "Change Management",
      description: "Formal change management process covering peer review, staging tests, change advisory board approval for major changes, and rollback procedures. The prior informal process has been retired; the replacement ITIL-aligned process is in design and not yet active.",
      status: "inactive" as const,
      ownerId: roUser.id,
    },
    {
      title: "Logging and Monitoring",
      description: "Centralized SIEM collects logs from all production systems, cloud infrastructure, and security tools. Alerts configured for anomalous patterns with 24/7 on-call security engineer coverage.",
      status: "active" as const,
      ownerId: rmUser.id,
    },
  ];

  const controls = await db.insert(controlsTable).values(
    controlDefs.map((c) => ({
      tenantId: tenant.id,
      title: c.title,
      description: c.description,
      status: c.status,
      ownerId: c.ownerId,
    }))
  ).returning();

  console.log(`Created ${controls.length} controls`);

  const controlByTitle = Object.fromEntries(controls.map((c) => [c.title, c]));

  // Map controls to framework requirements
  const controlMappings = [
    { controlTitle: "Multi-Factor Authentication (MFA)", framework: "iso", codes: ["A.5.17", "A.8.5"] },
    { controlTitle: "Multi-Factor Authentication (MFA)", framework: "soc2", codes: ["CC6.1", "CC6.2"] },
    { controlTitle: "Multi-Factor Authentication (MFA)", framework: "nist", codes: ["PR.AA-01", "PR.AA-02"] },
    { controlTitle: "Data Loss Prevention (DLP)", framework: "iso", codes: ["A.5.12", "A.8.12"] },
    { controlTitle: "Data Loss Prevention (DLP)", framework: "soc2", codes: ["CC6.7"] },
    { controlTitle: "Incident Response Plan", framework: "iso", codes: ["A.5.24", "A.5.26"] },
    { controlTitle: "Incident Response Plan", framework: "soc2", codes: ["CC7.3", "CC7.4"] },
    { controlTitle: "Incident Response Plan", framework: "nist", codes: ["RS.MA-01", "RC.RP-01"] },
    { controlTitle: "Patch Management", framework: "iso", codes: ["A.8.8"] },
    { controlTitle: "Patch Management", framework: "soc2", codes: ["CC7.1"] },
    { controlTitle: "Patch Management", framework: "nist", codes: ["DE.CM-01"] },
    { controlTitle: "Vendor Security Review", framework: "iso", codes: ["A.5.19", "A.5.20"] },
    { controlTitle: "Vendor Security Review", framework: "soc2", codes: ["CC9.2"] },
    { controlTitle: "Vendor Security Review", framework: "nist", codes: ["GV.SC-04", "GV.SC-06"] },
    { controlTitle: "Business Continuity Plan", framework: "iso", codes: ["A.5.29", "A.5.30"] },
    { controlTitle: "Business Continuity Plan", framework: "soc2", codes: ["A1.2", "A1.3"] },
    { controlTitle: "Encryption at Rest", framework: "iso", codes: ["A.8.24"] },
    { controlTitle: "Encryption at Rest", framework: "soc2", codes: ["CC6.1"] },
    { controlTitle: "Access Control Policy", framework: "iso", codes: ["A.5.15", "A.5.18"] },
    { controlTitle: "Access Control Policy", framework: "soc2", codes: ["CC6.3"] },
    { controlTitle: "Access Control Policy", framework: "nist", codes: ["PR.AA-05"] },
    { controlTitle: "Vulnerability Scanning", framework: "iso", codes: ["A.8.8"] },
    { controlTitle: "Vulnerability Scanning", framework: "soc2", codes: ["CC7.1"] },
    { controlTitle: "Vulnerability Scanning", framework: "nist", codes: ["ID.RA-01"] },
    { controlTitle: "Security Awareness Training", framework: "iso", codes: ["A.6.3"] },
    { controlTitle: "Security Awareness Training", framework: "soc2", codes: ["CC1.4"] },
    { controlTitle: "Security Awareness Training", framework: "nist", codes: ["GV.RR-04"] },
    { controlTitle: "Change Management", framework: "iso", codes: ["A.8.32"] },
    { controlTitle: "Change Management", framework: "soc2", codes: ["CC8.1"] },
    { controlTitle: "Logging and Monitoring", framework: "iso", codes: ["A.8.15", "A.8.16"] },
    { controlTitle: "Logging and Monitoring", framework: "soc2", codes: ["CC7.2"] },
    { controlTitle: "Logging and Monitoring", framework: "nist", codes: ["DE.CM-01", "DE.AE-02"] },
  ];

  const controlMapsToInsert: { tenantId: string; controlId: string; requirementId: string }[] = [];

  for (const mapping of controlMappings) {
    const control = controlByTitle[mapping.controlTitle];
    if (!control) continue;

    const codeMap = mapping.framework === "iso" ? isoCodes : mapping.framework === "soc2" ? soc2Codes : nistCodes;

    for (const code of mapping.codes) {
      const reqId = codeMap[code];
      if (reqId) {
        controlMapsToInsert.push({
          tenantId: tenant.id,
          controlId: control.id,
          requirementId: reqId,
        });
      }
    }
  }

  if (controlMapsToInsert.length > 0) {
    await db.insert(controlRequirementMapsTable).values(controlMapsToInsert);
    console.log(`Created ${controlMapsToInsert.length} control-requirement mappings`);
  }

  // Task 4: Seed 8 KRIs (2 breaching threshold)
  const kriDefs = [
    {
      riskTitle: "Cloud Provider Outage",
      name: "System Uptime %",
      description: "Percentage of time production systems are fully operational and accessible. Measured over rolling 30-day window.",
      warningThreshold: "99.5",
      criticalThreshold: "99.0",
      currentValue: "98.2",
      unit: "%",
    },
    {
      riskTitle: "Cyber Ransomware Attack",
      name: "Mean Time to Detect (MTTD)",
      description: "Average time in days between initial threat actor access and detection by security team. Lower values indicate better detection capability.",
      warningThreshold: "3",
      criticalThreshold: "7",
      currentValue: "2.1",
      unit: "days",
    },
    {
      riskTitle: "Cyber Ransomware Attack",
      name: "Open Critical Vulnerabilities",
      description: "Count of unpatched critical (CVSS 9.0+) vulnerabilities across all production systems. Should remain at zero.",
      warningThreshold: "2",
      criticalThreshold: "5",
      currentValue: "8",
      unit: "count",
    },
    {
      riskTitle: "Data Breach via Third-Party",
      name: "Failed Login Attempts per Day",
      description: "Daily count of failed authentication attempts across all production systems. Elevated counts may indicate brute force or credential stuffing attacks.",
      warningThreshold: "500",
      criticalThreshold: "1000",
      currentValue: "342",
      unit: "count/day",
    },
    {
      riskTitle: "Supply Chain Disruption",
      name: "Vendor SLA Breach Count",
      description: "Number of active vendor SLA breaches in the current quarter. Tracks performance failures across critical and high-tier vendors.",
      warningThreshold: "2",
      criticalThreshold: "5",
      currentValue: "1",
      unit: "count",
    },
    {
      riskTitle: "Regulatory Non-Compliance Fine",
      name: "Patch Compliance Rate %",
      description: "Percentage of systems with all required security patches applied within defined SLA windows. Critical patches must be applied within 24 hours.",
      warningThreshold: "90",
      criticalThreshold: "80",
      currentValue: "73.5",
      unit: "%",
    },
    {
      riskTitle: "Cyber Ransomware Attack",
      name: "Data Backup Success Rate %",
      description: "Percentage of scheduled backup jobs completing successfully. Failures are investigated within 4 hours and remediated within 24 hours.",
      warningThreshold: "98",
      criticalThreshold: "95",
      currentValue: "99.1",
      unit: "%",
    },
    {
      riskTitle: "Key Employee Departure",
      name: "Security Training Completion %",
      description: "Percentage of employees who have completed mandatory annual security awareness training. Tracked monthly with completion deadline of Q1 each year.",
      warningThreshold: "90",
      criticalThreshold: "80",
      currentValue: "87.3",
      unit: "%",
    },
  ];

  const kris = await db.insert(krisTable).values(
    kriDefs.map((k) => ({
      tenantId: tenant.id,
      riskId: riskByTitle[k.riskTitle].id,
      name: k.name,
      description: k.description,
      warningThreshold: k.warningThreshold,
      criticalThreshold: k.criticalThreshold,
      currentValue: k.currentValue,
      unit: k.unit,
    }))
  ).returning();

  console.log(`Created ${kris.length} KRIs`);

  // Task 5: Seed 4 incidents
  const incidentDefs = [
    {
      riskTitle: "Cyber Ransomware Attack",
      title: "Ransomware Attempt Blocked by EDR",
      description: "At 02:34 UTC on March 3rd, the EDR platform detected and blocked a ransomware payload (RansomHouse variant) attempting to execute on a developer workstation. The initial vector was a malicious macro in a phishing email that bypassed email filtering. EDR quarantined the file, isolated the endpoint, and triggered automatic IR workflow. No data was encrypted. Forensic analysis confirmed no lateral movement occurred. The developer's credentials were rotated as a precaution. Root cause: email security gateway failed to detect obfuscated macro. Remediation: updated email filtering rules and increased macro execution restrictions.",
      severity: "critical" as const,
      occurredAt: daysAgo(14),
      resolvedAt: daysAgo(12),
      reportedBy: rmUser.id,
    },
    {
      riskTitle: "Data Breach via Third-Party",
      title: "Accidental S3 Bucket Exposure",
      description: "A misconfigured S3 bucket containing approximately 12,000 customer support ticket records was inadvertently made publicly accessible for 6 hours on February 28th. The exposure was discovered through an automated cloud security posture management (CSPM) alert. The bucket contained support emails, ticket metadata, and some account identifiers. No financial data or passwords were present. The bucket was immediately restricted, and a data breach assessment was initiated. Legal counsel determined that the exposure met the GDPR notification threshold. 47 affected EU customers were notified within the 72-hour requirement. Root cause: infrastructure engineer applied incorrect bucket policy during routine maintenance.",
      severity: "high" as const,
      occurredAt: daysAgo(17),
      resolvedAt: daysAgo(14),
      reportedBy: rmUser.id,
    },
    {
      riskTitle: "Fraud and Financial Misstatement",
      title: "Unauthorized Access to Staging Environment",
      description: "On March 8th, security monitoring detected an internal employee accessing the staging financial system database using shared service account credentials outside of normal business hours. The employee did not have authorized access to this system. Investigation revealed the employee had obtained credentials from an internal wiki page where they had been inadvertently documented. No data was modified or exfiltrated. The shared credentials were immediately rotated, the wiki page was purged, and the employee was reminded of acceptable use policies. HR has been notified. Remediation includes audit of all shared credential documentation and implementation of privileged access management tooling.",
      severity: "medium" as const,
      occurredAt: daysAgo(9),
      resolvedAt: daysAgo(7),
      reportedBy: roUser.id,
    },
    {
      riskTitle: "Reputational Damage from Social Media",
      title: "Phishing Email Reported by Employee",
      description: "On March 15th, an employee reported receiving a spear-phishing email impersonating the CEO and requesting an urgent wire transfer of $47,000. The employee correctly identified the email as suspicious and reported it through the security incident reporting channel rather than following the fraudulent instructions. The email was analyzed — it used a lookalike domain (acm-corp.com vs acme.com) and spoofed display name. The domain was reported to abuse channels and blacklisted in email security gateway. All employees received a same-day reminder about wire transfer verification procedures. No financial loss occurred.",
      severity: "low" as const,
      occurredAt: daysAgo(2),
      reportedBy: roUser.id,
    },
  ];

  const incidents = await db.insert(incidentsTable).values(
    incidentDefs.map((i) => ({
      tenantId: tenant.id,
      riskId: riskByTitle[i.riskTitle].id,
      title: i.title,
      description: i.description,
      severity: i.severity,
      reportedBy: i.reportedBy,
      occurredAt: i.occurredAt,
      resolvedAt: i.resolvedAt || null,
    }))
  ).returning();

  console.log(`Created ${incidents.length} incidents`);

  // Task 6: Seed questionnaires with questions and responses
  const cloudscaleVendor = vendorByName["CloudScale Inc"];
  const dataguardVendor = vendorByName["DataGuard Pro"];

  const cloudscaleTemplate = [
    { id: "q1", text: "Does your organization maintain an ISO 27001 or SOC 2 Type II certification?", category: "security", answerType: "boolean" },
    { id: "q2", text: "Describe your incident response process and average time to notify customers of security incidents.", category: "security", answerType: "text" },
    { id: "q3", text: "What encryption standards do you use for data at rest and in transit?", category: "security", answerType: "text" },
    { id: "q4", text: "Do you conduct annual penetration tests? Please provide the date of the most recent test.", category: "security", answerType: "text" },
    { id: "q5", text: "How do you handle data deletion requests under GDPR/CCPA?", category: "privacy", answerType: "text" },
    { id: "q6", text: "What is your current system uptime SLA and what was your actual uptime in the past 12 months?", category: "operational", answerType: "text" },
    { id: "q7", text: "Do you have a documented business continuity plan? Has it been tested in the past 12 months?", category: "operational", answerType: "boolean" },
    { id: "q8", text: "Rate your organization's overall security maturity on a scale of 1-5.", category: "security", answerType: "scale" },
  ];

  const cloudscaleResponses = {
    q1: true,
    q2: "We maintain a 24/7 Security Operations Center and notify customers within 4 hours of confirmed incidents. Our documented MTTI is under 2 hours for P1 events.",
    q3: "All data at rest is encrypted using AES-256. Data in transit uses TLS 1.3. Encryption keys are managed via our dedicated KMS with quarterly rotation.",
    q4: "Annual penetration tests are conducted by a third-party firm. Most recent test: January 2026. Executive summary available upon request under NDA.",
    q5: "We process deletion requests within 30 days as required by GDPR. Deletion is confirmed in writing. Backup purge follows within 90 days per our retention policy.",
    q6: "Contractual SLA is 99.95% uptime. Actual uptime in the past 12 months: 99.97%. Incidents and postmortems are published on our status page.",
    q7: true,
    q8: 4,
  };

  const dataguardTemplate = [
    { id: "q1", text: "Does your organization maintain an ISO 27001 or SOC 2 Type II certification?", category: "security", answerType: "boolean" },
    { id: "q2", text: "Describe your data processing locations and whether data is transferred outside the EU/EEA.", category: "privacy", answerType: "text" },
    { id: "q3", text: "What access controls are in place for personnel accessing customer data?", category: "security", answerType: "text" },
    { id: "q4", text: "Do you conduct background checks on employees with access to customer data?", category: "security", answerType: "boolean" },
    { id: "q5", text: "Describe your vulnerability management program including scanning frequency and remediation SLAs.", category: "security", answerType: "text" },
    { id: "q6", text: "What is your subprocessor list and how are customers notified of changes?", category: "privacy", answerType: "text" },
    { id: "q7", text: "Do you have cyber liability insurance? Please provide coverage amount.", category: "operational", answerType: "text" },
  ];

  const [cloudscaleQuestionnaire] = await db.insert(questionnairesTable).values({
    tenantId: tenant.id,
    vendorId: cloudscaleVendor.id,
    title: "CloudScale Inc — Annual Security Assessment 2026",
    status: "completed" as const,
    template: cloudscaleTemplate,
    responses: cloudscaleResponses,
  }).returning();

  const [dataguardQuestionnaire] = await db.insert(questionnairesTable).values({
    tenantId: tenant.id,
    vendorId: dataguardVendor.id,
    title: "DataGuard Pro — Annual Security Assessment 2026",
    status: "in_progress" as const,
    template: dataguardTemplate,
    responses: {},
  }).returning();

  console.log("Created 2 vendor questionnaires");

  // Also insert questions into the question bank
  const questionBankDefs = [
    { text: "Does your organization maintain an ISO 27001 or SOC 2 Type II certification?", category: "security" as const, answerType: "boolean" as const, isCore: true },
    { text: "Describe your incident response process and average time to notify customers of security incidents.", category: "security" as const, answerType: "text" as const, isCore: true },
    { text: "What encryption standards do you use for data at rest and in transit?", category: "security" as const, answerType: "text" as const, isCore: true },
    { text: "Do you conduct annual penetration tests? Please provide the date of the most recent test.", category: "security" as const, answerType: "text" as const, isCore: true },
    { text: "How do you handle data deletion requests under GDPR/CCPA?", category: "privacy" as const, answerType: "text" as const, isCore: true },
    { text: "What is your current system uptime SLA and what was your actual uptime in the past 12 months?", category: "operational" as const, answerType: "text" as const, isCore: false },
    { text: "Do you have a documented business continuity plan? Has it been tested in the past 12 months?", category: "operational" as const, answerType: "boolean" as const, isCore: true },
    { text: "Rate your organization's overall security maturity on a scale of 1-5.", category: "security" as const, answerType: "scale" as const, isCore: false },
    { text: "Describe your data processing locations and whether data is transferred outside the EU/EEA.", category: "privacy" as const, answerType: "text" as const, isCore: true },
    { text: "What access controls are in place for personnel accessing customer data?", category: "security" as const, answerType: "text" as const, isCore: true },
    { text: "Do you conduct background checks on employees with access to customer data?", category: "security" as const, answerType: "boolean" as const, isCore: false },
    { text: "What is your subprocessor list and how are customers notified of changes?", category: "privacy" as const, answerType: "text" as const, isCore: false },
  ];

  await db.insert(questionnaireQuestionsTable).values(
    questionBankDefs.map((q) => ({
      tenantId: tenant.id,
      text: q.text,
      category: q.category,
      answerType: q.answerType,
      isCore: q.isCore,
    }))
  );

  console.log(`Created ${questionBankDefs.length} questionnaire questions in bank`);

  // Task 7: Seed 7 alerts total (2 existing + 5 new)
  await db.insert(alertsTable).values([
    {
      tenantId: tenant.id,
      type: "kri_breach",
      title: "Critical KRI Breach: System Uptime Below Threshold",
      description: "System uptime KRI has breached critical threshold of 99.5%",
      severity: "critical" as const,
      status: "active" as const,
      context: { kriName: "System Uptime", currentValue: 98.2, threshold: 99.5 },
    },
    {
      tenantId: tenant.id,
      type: "overdue_review",
      title: "Overdue Risk Review: Cloud Provider Outage",
      description: "Risk review for Cloud Provider Outage is 5 days past due",
      severity: "medium" as const,
      status: "active" as const,
      context: { riskTitle: "Cloud Provider Outage", daysPastDue: 5 },
    },
    {
      tenantId: tenant.id,
      type: "kri_breach",
      title: "Critical KRI Breach: Open Critical Vulnerabilities Exceeds Threshold",
      description: "Open critical vulnerabilities count (8) has breached critical threshold of 5. Immediate patching or compensating controls required.",
      severity: "critical" as const,
      status: "active" as const,
      context: { kriName: "Open Critical Vulnerabilities", currentValue: 8, threshold: 5, riskTitle: "Cyber Ransomware Attack" },
    },
    {
      tenantId: tenant.id,
      type: "vendor_overdue_review",
      title: "High: Vendor Annual Review Overdue — DataGuard Pro",
      description: "Annual security assessment for DataGuard Pro (High-tier vendor) is 45 days overdue. Questionnaire sent but not completed. Escalation required.",
      severity: "high" as const,
      status: "active" as const,
      context: { vendorName: "DataGuard Pro", vendorTier: "high", daysPastDue: 45 },
    },
    {
      tenantId: tenant.id,
      type: "agent_finding",
      title: "AI Agent Finding: Cascade Chain Detected Across 3 Risks",
      description: "Risk agent identified a cascade chain where ransomware signal correlates with vendor security incident and open critical vulnerability, suggesting coordinated threat activity.",
      severity: "medium" as const,
      status: "acknowledged" as const,
      context: { findingType: "cascade_chain", relatedRisks: ["Cyber Ransomware Attack", "Data Breach via Third-Party"] },
    },
    {
      tenantId: tenant.id,
      type: "kri_breach",
      title: "Warning: Patch Compliance Rate Below Warning Threshold",
      description: "Patch compliance rate (73.5%) has fallen below the warning threshold of 90%. 26.5% of systems have outstanding security patches beyond SLA.",
      severity: "low" as const,
      status: "active" as const,
      context: { kriName: "Patch Compliance Rate", currentValue: 73.5, warningThreshold: 90, criticalThreshold: 80 },
    },
    {
      tenantId: tenant.id,
      type: "data_breach",
      title: "Resolved: Accidental S3 Bucket Exposure Contained",
      description: "The S3 bucket misconfiguration incident has been fully remediated. Affected customers notified, bucket policy corrected, and CSPM rule updated to prevent recurrence.",
      severity: "high" as const,
      status: "resolved" as const,
      acknowledgedBy: rmUser.id,
      acknowledgedAt: daysAgo(14),
      context: { incidentTitle: "Accidental S3 Bucket Exposure", resolvedAt: daysAgo(14).toISOString() },
    },
  ]);

  console.log("Created 7 alerts");

  // Task 8: Seed agent findings (need an agent run first)
  const [agentRun] = await db.insert(agentRunsTable).values({
    tenantId: tenant.id,
    status: "completed" as const,
    policyTier: "observe" as const,
    model: "gpt-4o",
    tokenCount: 18450,
    promptTokens: 14200,
    completionTokens: 4250,
    estimatedCost: "0.184500",
    durationMs: 12340,
    findingCount: 4,
    startedAt: daysAgo(3),
    completedAt: daysAgo(3),
  }).returning();

  const findingDefs = [
    {
      type: "cascade_chain" as const,
      severity: "critical" as const,
      title: "Cascade Chain: Ransomware Signal → Vendor Incident → Open CVE",
      narrative: "A critical cascade chain has been identified involving three interconnected risk events. The SIEM ransomware signal (Eastern European IP range) correlates temporally with the DataGuard Pro security incident report and the current count of 8 unpatched critical CVEs. This pattern is consistent with a coordinated supply chain attack where initial access via a compromised vendor is leveraged to exploit known vulnerabilities before deploying ransomware. The probability of these three events being independent is estimated at less than 3%. Immediate isolation review of all DataGuard Pro API integrations is recommended, along with emergency patching of the top 3 critical CVEs.",
      linkedEntities: [
        { type: "risk", id: "Cyber Ransomware Attack", title: "Cyber Ransomware Attack" },
        { type: "risk", id: "Data Breach via Third-Party", title: "Data Breach via Third-Party" },
        { type: "vendor", id: "DataGuard Pro", title: "DataGuard Pro" },
      ],
      proposedAction: { type: "escalate", description: "Initiate Tier 1 incident response. Isolate DataGuard Pro API integration. Emergency patch critical CVEs within 24 hours.", priority: "immediate" },
      status: "pending_review" as const,
    },
    {
      type: "cluster" as const,
      severity: "high" as const,
      title: "Risk Cluster: Three Technology Risks Share Common Root Cause",
      narrative: "Semantic and structural analysis of the risk register reveals a high-confidence cluster among Cloud Provider Outage, Cyber Ransomware Attack, and Vendor Lock-in Dependency. All three risks share a common root cause: excessive concentration dependency on AWS infrastructure without adequate redundancy or exit options. The current single-region deployment that elevates outage risk also constrains the ransomware recovery options and deepens vendor lock-in. Treating these risks individually with disconnected controls is 40% less efficient than addressing the root cause through an architectural resilience program. A unified treatment plan addressing multi-cloud readiness would reduce aggregate risk score by an estimated 35%.",
      linkedEntities: [
        { type: "risk", id: "Cloud Provider Outage", title: "Cloud Provider Outage" },
        { type: "risk", id: "Cyber Ransomware Attack", title: "Cyber Ransomware Attack" },
        { type: "risk", id: "Vendor Lock-in Dependency", title: "Vendor Lock-in Dependency" },
      ],
      proposedAction: { type: "create_treatment", description: "Create a unified Multi-Cloud Resilience Program treatment linking all three risks. Assign to Architecture team with 12-month timeline.", priority: "high" },
      status: "acknowledged" as const,
    },
    {
      type: "predictive_signal" as const,
      severity: "medium" as const,
      title: "Predictive Signal: Uptime Degradation Pattern Predicts Outage Event",
      narrative: "Time-series analysis of the System Uptime KRI over the past 90 days shows a statistically significant downward trend (R²=0.78). Current uptime of 98.2% represents a 1.3 percentage point decline from the 99.5% baseline observed in Q4 2025. If the current trend continues linearly, uptime is projected to breach the critical 99.0% threshold within 18 days. Historical data shows that once this threshold is breached, a major outage event (>4 hours) occurs within 7 days in 67% of cases. The degradation correlates with increased deployment frequency following the January 2026 platform rewrite. A deployment freeze or enhanced rollback procedures are recommended.",
      linkedEntities: [
        { type: "risk", id: "Cloud Provider Outage", title: "Cloud Provider Outage" },
        { type: "kri", id: "System Uptime %", title: "System Uptime %" },
      ],
      proposedAction: { type: "schedule_review", description: "Schedule emergency architecture review. Consider deployment frequency reduction until uptime trend reverses. Test recovery procedures within 7 days.", priority: "medium" },
      status: "pending_review" as const,
    },
    {
      type: "cross_domain" as const,
      severity: "high" as const,
      title: "Cross-Domain Linkage: Compliance Gap Amplifies Financial Risk",
      narrative: "Cross-domain analysis reveals a previously unidentified dependency between the Regulatory Non-Compliance risk and the Fraud and Financial Misstatement risk. The compliance gap in automated evidence collection (specifically, lack of continuous monitoring for privileged access to financial systems) directly reduces the detectability of fraudulent financial transactions. The SOC 2 CC6.1 and CC7.2 control gaps identified in the compliance assessment correspond precisely to the access control weaknesses that would enable financial fraud. This cross-domain amplification means the financial risk's effective impact score should be elevated from its current rating. A single remediation investment (deploying SIEM rules for financial system privileged access) would simultaneously close the compliance gap and reduce fraud detectability risk.",
      linkedEntities: [
        { type: "risk", id: "Regulatory Non-Compliance Fine", title: "Regulatory Non-Compliance Fine" },
        { type: "risk", id: "Fraud and Financial Misstatement", title: "Fraud and Financial Misstatement" },
        { type: "control", id: "Logging and Monitoring", title: "Logging and Monitoring" },
      ],
      proposedAction: { type: "create_treatment", description: "Prioritize SIEM deployment for financial system access monitoring. Map this treatment to both compliance and financial fraud risks.", priority: "high" },
      status: "pending_review" as const,
    },
  ];

  await db.insert(agentFindingsTable).values(
    findingDefs.map((f) => ({
      tenantId: tenant.id,
      runId: agentRun.id,
      type: f.type,
      severity: f.severity,
      title: f.title,
      narrative: f.narrative,
      linkedEntities: f.linkedEntities,
      proposedAction: f.proposedAction,
      status: f.status,
    }))
  );

  console.log(`Created 4 agent findings`);

  // Task 9: Seed 6 review cycles
  const reviewCycleDefs = [
    {
      riskTitle: "Cloud Provider Outage",
      reviewerId: rmUser.id,
      status: "completed" as const,
      dueDate: daysAgo(30),
      completedAt: daysAgo(28),
      notes: "Review completed. Multi-region treatment plan approved and added to Q2 roadmap. Risk score maintained at 15 (Critical). Next review scheduled for Q3 2026.",
    },
    {
      riskTitle: "Cyber Ransomware Attack",
      reviewerId: rmUser.id,
      status: "completed" as const,
      dueDate: daysAgo(15),
      completedAt: daysAgo(13),
      notes: "EDR coverage improvement noted (91% → 94%). Insurance transfer treatment completed. Open CVE count remains elevated at 8 — patching treatment escalated to in_progress. Risk score remains High.",
    },
    {
      riskTitle: "Data Breach via Third-Party",
      reviewerId: rmUser.id,
      status: "scheduled" as const,
      dueDate: daysFromNow(14),
      notes: null,
    },
    {
      riskTitle: "Regulatory Non-Compliance Fine",
      reviewerId: rmUser.id,
      status: "scheduled" as const,
      dueDate: daysFromNow(21),
      notes: null,
    },
    {
      riskTitle: "Supply Chain Disruption",
      reviewerId: roUser.id,
      status: "scheduled" as const,
      dueDate: daysFromNow(7),
      notes: null,
    },
    {
      riskTitle: "Vendor Lock-in Dependency",
      reviewerId: roUser.id,
      status: "overdue" as const,
      dueDate: daysAgo(5),
      notes: null,
    },
  ];

  await db.insert(reviewCyclesTable).values(
    reviewCycleDefs.map((r) => ({
      tenantId: tenant.id,
      riskId: riskByTitle[r.riskTitle].id,
      reviewerId: r.reviewerId,
      status: r.status,
      dueDate: r.dueDate,
      completedAt: r.completedAt || null,
      notes: r.notes,
    }))
  );

  console.log("Created 6 review cycles");

  // Task 10: Seed 2 acceptance memoranda for accepted risks
  const marketExpansionRisk = riskByTitle["Market Expansion Failure"];
  const tolerateTreatment = treatments.find((t) => t.riskId === marketExpansionRisk.id && t.strategy === "tolerate");

  await db.insert(acceptanceMemorandaTable).values([
    {
      tenantId: tenant.id,
      riskId: marketExpansionRisk.id,
      treatmentId: tolerateTreatment?.id || null,
      memorandumText: `RISK ACCEPTANCE MEMORANDUM

Risk Title: Market Expansion Failure
Risk Category: Strategic
Current Risk Score: Medium (Likelihood: 3, Impact: 2)
Date of Acceptance: ${daysAgo(10).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

EXECUTIVE SUMMARY
The Board of Directors and Risk Committee of Acme Corp have formally reviewed and accepted the risk of Market Expansion Failure associated with the planned entry into the Asia-Pacific (APAC) market. This memorandum documents the basis for acceptance and the conditions under which this risk will be monitored.

JUSTIFICATION FOR ACCEPTANCE
1. Strategic Necessity: Geographic diversification is a Board-mandated strategic priority for FY2026-2027. Failure to expand internationally would limit total addressable market and expose the company to concentration risk in the North American market.

2. Risk-Adjusted Return: Financial modeling projects a 3-year IRR of 28% on APAC investment under base case assumptions, well above the company's 15% hurdle rate. Even under pessimistic scenarios (50% revenue shortfall), the investment remains positive NPV.

3. Bounded Downside: The Board has approved a maximum investment of $4.2M over 24 months with defined exit criteria. If revenue targets are not achieved by Q4 2027, the expansion will be wound down with estimated recovery of $1.8M in assets.

4. Alternative Analysis: Alternative strategies (licensing, partnership, white-label) were evaluated but rejected as insufficient to achieve strategic market presence goals.

CONDITIONS OF ACCEPTANCE
- Quarterly KPI review by the Risk Committee (KPIs: Customer acquisition rate, Revenue vs. target, Burn rate)
- Automatic escalation trigger if quarterly revenue falls below 40% of target for two consecutive quarters
- Annual risk re-assessment by external consultant
- Maximum capital commitment of $4.2M; any request exceeding this requires Board re-approval

This acceptance expires on December 31, 2027, at which point the risk must be formally re-evaluated.`,
      status: "approved" as const,
      requestedById: adminUser.id,
      approverId: execUser.id,
      approvedAt: daysAgo(10),
    },
    {
      tenantId: tenant.id,
      riskId: riskByTitle["Fraud and Financial Misstatement"].id,
      treatmentId: null,
      memorandumText: `RISK ACCEPTANCE MEMORANDUM

Risk Title: Fraud and Financial Misstatement (Draft — Residual Acceptance)
Risk Category: Financial
Current Risk Score: High (Likelihood: 1, Impact: 5)
Date of Acceptance: ${daysAgo(45).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

EXECUTIVE SUMMARY
Acme Corp's Risk Committee has reviewed the residual fraud and financial misstatement risk remaining after implementation of primary detective and preventive controls. While the inherent risk is rated Critical, the application of four-eyes approval, external audit, and SIEM-based monitoring reduces residual risk to an acceptable level for the current operating period. This memorandum documents the acceptance of residual risk pending full deployment of privileged access management (PAM) tooling.

JUSTIFICATION FOR ACCEPTANCE
1. Existing Controls Sufficiency: The combination of mandatory dual-approval for transactions above $10,000, quarterly external audit review, and SIEM anomaly detection provides adequate compensating controls for the current risk exposure period.

2. Transition Period: Full PAM deployment is projected for Q2 2026. This acceptance memorandum covers the interim period only and expires upon PAM go-live or June 30, 2026, whichever comes first.

3. Insurance Coverage: Directors and Officers (D&O) and financial crime insurance policies are in force, providing $10M coverage per incident for financial fraud losses.

4. Low Frequency Assessment: Based on 5-year historical data, no material financial misstatement or fraud event has occurred. Actuarial likelihood remains at 1 (Rare) with strong compensating controls in place.

CONDITIONS OF ACCEPTANCE
- Monthly review of SIEM alerts related to financial system access
- Immediate escalation to Audit Committee if any anomaly exceeds $5,000 threshold
- External auditor review of this acceptance rationale at next quarterly audit
- Automatic expiry: June 30, 2026 or PAM deployment date, whichever is earlier
- Any material change in Finance team structure triggers mandatory re-evaluation

This acceptance does not waive any compliance obligations or external audit requirements.`,
      status: "approved" as const,
      requestedById: rmUser.id,
      approverId: execUser.id,
      approvedAt: daysAgo(45),
    },
  ]);

  console.log("Created 2 acceptance memoranda");

  // Task 11: Seed 12 audit events spread over past 30 days
  const auditEventDefs = [
    {
      userId: adminUser.id,
      action: "risk.created",
      entityType: "risk",
      entityId: riskByTitle["Cyber Ransomware Attack"].id,
      payload: { title: "Cyber Ransomware Attack", category: "technology", status: "open", likelihood: 2, impact: 5 },
      createdAt: daysAgo(29),
    },
    {
      userId: rmUser.id,
      action: "risk.status_changed",
      entityType: "risk",
      entityId: riskByTitle["Key Employee Departure"].id,
      payload: { from: "open", to: "mitigated", reason: "Cross-training and documentation program completed for 10 of 12 critical positions" },
      createdAt: daysAgo(25),
    },
    {
      userId: rmUser.id,
      action: "treatment.created",
      entityType: "treatment",
      entityId: treatments[0].id,
      payload: { riskTitle: "Cloud Provider Outage", strategy: "treat", description: "Multi-region active-active deployment" },
      createdAt: daysAgo(22),
    },
    {
      userId: adminUser.id,
      action: "vendor.onboarded",
      entityType: "vendor",
      entityId: vendorByName["MarketBridge Analytics"].id,
      payload: { vendorName: "MarketBridge Analytics", tier: "low", category: "Analytics", contactEmail: "info@marketbridge.co" },
      createdAt: daysAgo(20),
    },
    {
      userId: rmUser.id,
      action: "alert.acknowledged",
      entityType: "alert",
      payload: { alertTitle: "Resolved: Accidental S3 Bucket Exposure Contained", severity: "high", acknowledgedBy: rmUser.name },
      createdAt: daysAgo(17),
    },
    {
      userId: roUser.id,
      action: "control.updated",
      entityType: "control",
      entityId: controlByTitle["Patch Management"].id,
      payload: { controlTitle: "Patch Management", change: "Updated SLA for critical patches from 48 hours to 24 hours", status: "active" },
      createdAt: daysAgo(15),
    },
    {
      userId: rmUser.id,
      action: "kri.threshold_breached",
      entityType: "kri",
      entityId: kris.find((k) => k.name === "Open Critical Vulnerabilities")?.id,
      payload: { kriName: "Open Critical Vulnerabilities", currentValue: 8, criticalThreshold: 5, riskTitle: "Cyber Ransomware Attack" },
      createdAt: daysAgo(12),
    },
    {
      userId: rmUser.id,
      action: "incident.created",
      entityType: "incident",
      entityId: incidents[0].id,
      payload: { title: "Ransomware Attempt Blocked by EDR", severity: "critical", riskTitle: "Cyber Ransomware Attack" },
      createdAt: daysAgo(14),
    },
    {
      userId: rmUser.id,
      action: "incident.resolved",
      entityType: "incident",
      entityId: incidents[0].id,
      payload: { title: "Ransomware Attempt Blocked by EDR", resolvedBy: rmUser.name, resolution: "No data encrypted. Endpoint isolated and credentials rotated. Email filtering rules updated." },
      createdAt: daysAgo(12),
    },
    {
      userId: adminUser.id,
      action: "risk.status_changed",
      entityType: "risk",
      entityId: riskByTitle["Fraud and Financial Misstatement"].id,
      payload: { from: "open", to: "accepted", reason: "Risk Committee accepted residual fraud risk pending PAM deployment. Acceptance memorandum approved." },
      createdAt: daysAgo(45),
    },
    {
      userId: execUser.id,
      action: "memorandum.approved",
      entityType: "acceptance_memorandum",
      entityId: riskByTitle["Market Expansion Failure"].id,
      payload: { riskTitle: "Market Expansion Failure", approvedBy: execUser.name, status: "approved" },
      createdAt: daysAgo(10),
    },
    {
      userId: rmUser.id,
      action: "questionnaire.sent",
      entityType: "questionnaire",
      entityId: dataguardQuestionnaire.id,
      payload: { vendorName: "DataGuard Pro", questionCount: 7, sentBy: rmUser.name },
      createdAt: daysAgo(7),
    },
    {
      userId: roUser.id,
      action: "risk.status_changed",
      entityType: "risk",
      entityId: riskByTitle["Market Expansion Failure"].id,
      payload: { from: "open", to: "accepted", reason: "Board acceptance memorandum signed. Formal risk acceptance documented and approved." },
      createdAt: daysAgo(9),
    },
    {
      userId: rmUser.id,
      action: "control.created",
      entityType: "control",
      entityId: controlByTitle["Change Management"].id,
      payload: { controlTitle: "Change Management", status: "inactive", note: "Prior informal change process retired; ITIL-aligned replacement in design" },
      createdAt: daysAgo(5),
    },
    {
      userId: roUser.id,
      action: "incident.created",
      entityType: "incident",
      entityId: incidents[3].id,
      payload: { title: "Phishing Email Reported by Employee", severity: "low", reportedBy: roUser.name },
      createdAt: daysAgo(2),
    },
  ];

  const auditEventsToInsert = auditEventDefs.map((e) => ({
    tenantId: tenant.id,
    userId: e.userId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId || null,
    payload: e.payload,
    createdAt: e.createdAt,
  }));

  await db.insert(auditEventsTable).values(auditEventsToInsert);

  console.log(`Created ${auditEventsToInsert.length} audit events`);

  console.log("\nSeed completed successfully!");
  console.log("Login credentials: any-user@acme.com / password123");
  console.log("Risk Executive: riskexec@acme.com / password123");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
