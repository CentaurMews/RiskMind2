import { db, questionnaireQuestionsTable } from "./index";
import { sql } from "drizzle-orm";

const CORE_QUESTIONS = [
  { text: "Does your organization have a formal information security policy?", category: "security" as const, answerType: "boolean" as const, weight: "2.00" },
  { text: "Do you conduct regular security awareness training for all employees?", category: "security" as const, answerType: "boolean" as const, weight: "1.50" },
  { text: "Is multi-factor authentication enforced for all critical systems?", category: "security" as const, answerType: "boolean" as const, weight: "2.00" },
  { text: "Do you have an incident response plan documented and tested?", category: "security" as const, answerType: "boolean" as const, weight: "2.00" },
  { text: "Do you perform regular vulnerability assessments and penetration testing?", category: "security" as const, answerType: "boolean" as const, weight: "1.75" },
  { text: "Are data backups performed regularly and tested for restoration?", category: "security" as const, answerType: "boolean" as const, weight: "1.50" },
  { text: "Do you encrypt data at rest and in transit?", category: "security" as const, answerType: "boolean" as const, weight: "2.00" },
  { text: "Do you have a privacy policy compliant with applicable regulations (GDPR, CCPA)?", category: "privacy" as const, answerType: "boolean" as const, weight: "2.00" },
  { text: "Is personal data inventory maintained and regularly updated?", category: "privacy" as const, answerType: "boolean" as const, weight: "1.50" },
  { text: "Do you have data retention and deletion policies in place?", category: "privacy" as const, answerType: "boolean" as const, weight: "1.50" },
  { text: "Are data processing agreements in place with all sub-processors?", category: "privacy" as const, answerType: "boolean" as const, weight: "1.75" },
  { text: "Do you have a process for handling data subject access requests?", category: "privacy" as const, answerType: "boolean" as const, weight: "1.50" },
  { text: "Do you have a documented business continuity plan?", category: "operational" as const, answerType: "boolean" as const, weight: "1.75" },
  { text: "What is your average system uptime over the past 12 months?", category: "operational" as const, answerType: "scale" as const, weight: "1.50" },
  { text: "Do you have defined SLAs for service availability and support response times?", category: "operational" as const, answerType: "boolean" as const, weight: "1.50" },
  { text: "Is there a formal change management process?", category: "operational" as const, answerType: "boolean" as const, weight: "1.25" },
  { text: "Do you carry cyber liability insurance?", category: "operational" as const, answerType: "boolean" as const, weight: "1.25" },
  { text: "Have you experienced any data breaches in the past 3 years?", category: "security" as const, answerType: "boolean" as const, weight: "2.00" },
  { text: "Do you comply with any recognized security frameworks (SOC2, ISO 27001, NIST)?", category: "security" as const, answerType: "text" as const, weight: "2.00" },
  { text: "Describe your access control and role-based permission model.", category: "security" as const, answerType: "text" as const, weight: "1.75" },
];

const CATEGORY_QUESTIONS: Record<string, Array<{ text: string; category: string; answerType: "text" | "boolean" | "scale"; weight: string }>> = {
  technology: [
    { text: "Do you follow secure software development lifecycle (SDLC) practices?", category: "security", answerType: "boolean", weight: "1.75" },
    { text: "Are code reviews mandatory before deployment to production?", category: "security", answerType: "boolean", weight: "1.50" },
    { text: "Do you use automated security scanning tools in your CI/CD pipeline?", category: "security", answerType: "boolean", weight: "1.75" },
    { text: "Is your infrastructure hosted in SOC2-certified cloud environments?", category: "security", answerType: "boolean", weight: "1.50" },
    { text: "Do you have a container security and orchestration policy?", category: "security", answerType: "boolean", weight: "1.25" },
    { text: "How do you handle API security and rate limiting?", category: "security", answerType: "text", weight: "1.50" },
    { text: "Do you provide single sign-on (SSO) integration options?", category: "operational", answerType: "boolean", weight: "1.25" },
    { text: "What is your software release cadence and patching SLA?", category: "operational", answerType: "text", weight: "1.25" },
    { text: "Do you support data portability and export in standard formats?", category: "operational", answerType: "boolean", weight: "1.25" },
    { text: "Rate your disaster recovery capabilities for technology infrastructure.", category: "operational", answerType: "scale", weight: "1.50" },
  ],
  financial_services: [
    { text: "Are you compliant with PCI DSS requirements?", category: "security", answerType: "boolean", weight: "2.00" },
    { text: "Do you perform SOX compliance audits?", category: "operational", answerType: "boolean", weight: "1.75" },
    { text: "Is there segregation of duties in financial transaction processing?", category: "operational", answerType: "boolean", weight: "1.75" },
    { text: "Do you have anti-money laundering (AML) controls in place?", category: "security", answerType: "boolean", weight: "2.00" },
    { text: "Are financial transactions monitored for fraud in real-time?", category: "security", answerType: "boolean", weight: "1.75" },
    { text: "Do you comply with relevant banking regulatory requirements (OCC, FDIC, FCA)?", category: "operational", answerType: "text", weight: "1.75" },
    { text: "How do you handle financial data segregation across tenants?", category: "privacy", answerType: "text", weight: "1.50" },
    { text: "Do you have a documented sanctions screening process?", category: "operational", answerType: "boolean", weight: "1.50" },
    { text: "Rate your financial reporting accuracy and timeliness.", category: "operational", answerType: "scale", weight: "1.50" },
    { text: "Is there a process for regulatory change management and impact assessment?", category: "operational", answerType: "boolean", weight: "1.50" },
  ],
  healthcare: [
    { text: "Are you HIPAA compliant and do you hold relevant certifications?", category: "privacy", answerType: "boolean", weight: "2.00" },
    { text: "Do you have Business Associate Agreements (BAA) with all partners?", category: "privacy", answerType: "boolean", weight: "2.00" },
    { text: "Is Protected Health Information (PHI) encrypted at all stages?", category: "security", answerType: "boolean", weight: "2.00" },
    { text: "Do you have audit trails for all PHI access and modifications?", category: "security", answerType: "boolean", weight: "1.75" },
    { text: "Is there a minimum necessary standard for PHI access?", category: "privacy", answerType: "boolean", weight: "1.50" },
    { text: "Do you comply with HITECH Act requirements for breach notification?", category: "operational", answerType: "boolean", weight: "1.75" },
    { text: "How do you handle patient consent management?", category: "privacy", answerType: "text", weight: "1.50" },
    { text: "Are medical devices and IoT endpoints secured per FDA guidance?", category: "security", answerType: "boolean", weight: "1.50" },
    { text: "Rate your clinical data integrity assurance processes.", category: "operational", answerType: "scale", weight: "1.50" },
    { text: "Do you perform regular HIPAA risk assessments?", category: "security", answerType: "boolean", weight: "1.75" },
  ],
  retail: [
    { text: "Do you comply with PCI DSS for payment card processing?", category: "security", answerType: "boolean", weight: "2.00" },
    { text: "How do you protect customer personally identifiable information (PII)?", category: "privacy", answerType: "text", weight: "1.75" },
    { text: "Do you have a point-of-sale security policy?", category: "security", answerType: "boolean", weight: "1.50" },
    { text: "Is customer data segmented from operational data?", category: "privacy", answerType: "boolean", weight: "1.50" },
    { text: "Do you have supply chain security controls?", category: "operational", answerType: "boolean", weight: "1.50" },
    { text: "How do you handle seasonal scaling and capacity planning?", category: "operational", answerType: "text", weight: "1.25" },
    { text: "Are e-commerce platforms protected against OWASP Top 10 vulnerabilities?", category: "security", answerType: "boolean", weight: "1.75" },
    { text: "Do you have a product recall and safety notification process?", category: "operational", answerType: "boolean", weight: "1.25" },
    { text: "Rate your consumer data protection and privacy compliance maturity.", category: "privacy", answerType: "scale", weight: "1.50" },
    { text: "Do you conduct regular security assessments of third-party marketplace integrations?", category: "security", answerType: "boolean", weight: "1.50" },
  ],
  logistics: [
    { text: "Do you have GPS tracking and chain-of-custody documentation?", category: "operational", answerType: "boolean", weight: "1.50" },
    { text: "Are your logistics systems protected against cyber threats?", category: "security", answerType: "boolean", weight: "1.75" },
    { text: "Do you comply with customs and trade compliance regulations?", category: "operational", answerType: "boolean", weight: "1.50" },
    { text: "How do you handle hazardous materials and environmental compliance?", category: "operational", answerType: "text", weight: "1.50" },
    { text: "Is there a documented process for carrier vetting and qualification?", category: "operational", answerType: "boolean", weight: "1.25" },
    { text: "Do you have real-time visibility into supply chain operations?", category: "operational", answerType: "boolean", weight: "1.25" },
    { text: "Are warehouse management systems secured with role-based access?", category: "security", answerType: "boolean", weight: "1.50" },
    { text: "Do you have contingency plans for transportation disruptions?", category: "operational", answerType: "boolean", weight: "1.50" },
    { text: "Rate your shipment data accuracy and integrity controls.", category: "operational", answerType: "scale", weight: "1.50" },
    { text: "Do you perform regular audits of subcontracted logistics providers?", category: "operational", answerType: "boolean", weight: "1.50" },
  ],
};

async function seedQuestions() {
  console.log("Seeding questionnaire questions...");

  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(questionnaireQuestionsTable);
  if (existing[0].count > 0) {
    console.log(`Already have ${existing[0].count} questions. Skipping seed.`);
    return;
  }

  const coreRows = CORE_QUESTIONS.map(q => ({
    text: q.text,
    category: q.category,
    answerType: q.answerType,
    weight: q.weight,
    isCore: true,
    vendorCategory: null,
  }));

  await db.insert(questionnaireQuestionsTable).values(coreRows);
  console.log(`Seeded ${coreRows.length} core questions.`);

  for (const [vendorCat, questions] of Object.entries(CATEGORY_QUESTIONS)) {
    const catRows = questions.map(q => ({
      text: q.text,
      category: q.category as "security" | "privacy" | "operational" | "technology" | "financial_services" | "healthcare" | "retail" | "logistics" | "general",
      answerType: q.answerType,
      weight: q.weight,
      isCore: false,
      vendorCategory: vendorCat,
    }));
    await db.insert(questionnaireQuestionsTable).values(catRows);
    console.log(`Seeded ${catRows.length} questions for category: ${vendorCat}`);
  }

  console.log("Done seeding questionnaire questions.");
}

seedQuestions().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
