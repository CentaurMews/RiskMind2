import { db, assessmentTemplatesTable } from "..";
import { and, eq, like } from "drizzle-orm";

// Local type alias matching AssessmentTemplateQuestions from assessment-engine.ts
// Kept in sync to avoid cross-package imports
interface QuestionOption {
  id: string;
  label: string;
  value: string;
  numericValue?: number;
}

interface BranchCondition {
  questionId: string;
  operator: "equals" | "contains" | "greater_than";
  value: string | number;
  action: "show" | "hide";
}

interface AssessmentQuestion {
  id: string;
  sectionId: string;
  text: string;
  type: "text" | "boolean" | "multiple_choice" | "numeric";
  weight: number;
  required: boolean;
  options?: QuestionOption[];
  numericMin?: number;
  numericMax?: number;
  conditions: BranchCondition[];
  isAiGenerated?: boolean;
  triggeredByQuestionId?: string;
}

interface AssessmentSection {
  id: string;
  name: string;
  order: number;
  questions: AssessmentQuestion[];
}

interface AssessmentTemplateQuestions {
  sections: AssessmentSection[];
  version: number;
}

/**
 * Seeds 3 pre-built assessment templates for a given tenant.
 * Uses idempotent upsert: skips if template with same title + [PREBUILT] already exists.
 */
export async function seedPrebuiltTemplates(tenantId: string) {
  // Check if templates are already seeded
  const existing = await db
    .select({ id: assessmentTemplatesTable.id })
    .from(assessmentTemplatesTable)
    .where(
      and(
        eq(assessmentTemplatesTable.tenantId, tenantId),
        like(assessmentTemplatesTable.description, "[PREBUILT]%"),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Seed] Pre-built templates already seeded for tenant ${tenantId}, skipping`);
    return;
  }

  // ─── Template 1: Vendor Security Assessment ─────────────────────────────────
  const vendorSecurityTemplate: AssessmentTemplateQuestions = {
    version: 1,
    sections: [
      {
        id: "sec-vs-001",
        name: "Access Control",
        order: 1,
        questions: [
          {
            id: "q-vs-001",
            sectionId: "sec-vs-001",
            text: "Does your organization enforce multi-factor authentication (MFA) for all user accounts?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-002",
            sectionId: "sec-vs-001",
            text: "What is the minimum required password length in your organization's policy?",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 8,
            numericMax: 128,
            conditions: [],
          },
          {
            id: "q-vs-003",
            sectionId: "sec-vs-001",
            text: "How frequently are privileged access rights reviewed?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-vs-003-a", label: "Monthly", value: "monthly", numericValue: 1.0 },
              { id: "q-vs-003-b", label: "Quarterly", value: "quarterly", numericValue: 0.75 },
              { id: "q-vs-003-c", label: "Annually", value: "annually", numericValue: 0.5 },
              { id: "q-vs-003-d", label: "Never", value: "never", numericValue: 0.0 },
            ],
            conditions: [],
          },
          {
            id: "q-vs-004",
            sectionId: "sec-vs-001",
            text: "Describe your access provisioning process for new employees or contractors.",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
          {
            id: "q-vs-005",
            sectionId: "sec-vs-001",
            text: "What is your timeline for revoking access for terminated employees?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-vs-005-a", label: "Immediately (same day)", value: "immediately", numericValue: 1.0 },
              { id: "q-vs-005-b", label: "Within 24 hours", value: "24hrs", numericValue: 0.75 },
              { id: "q-vs-005-c", label: "Within 48 hours", value: "48hrs", numericValue: 0.5 },
              { id: "q-vs-005-d", label: "Within 1 week", value: "1week", numericValue: 0.25 },
              { id: "q-vs-005-e", label: "No defined process", value: "no-process", numericValue: 0.0 },
            ],
            conditions: [],
          },
        ],
      },
      {
        id: "sec-vs-002",
        name: "Data Protection & Encryption",
        order: 2,
        questions: [
          {
            id: "q-vs-006",
            sectionId: "sec-vs-002",
            text: "Is data at rest encrypted?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-007",
            sectionId: "sec-vs-002",
            text: "What encryption algorithm is used for data at rest?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-vs-007-a", label: "AES-256", value: "AES-256", numericValue: 1.0 },
              { id: "q-vs-007-b", label: "AES-128", value: "AES-128", numericValue: 0.75 },
              { id: "q-vs-007-c", label: "3DES", value: "3DES", numericValue: 0.25 },
              { id: "q-vs-007-d", label: "None", value: "none", numericValue: 0.0 },
            ],
            conditions: [],
          },
          {
            id: "q-vs-008",
            sectionId: "sec-vs-002",
            text: "Does your organization have a data classification policy?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-009",
            sectionId: "sec-vs-002",
            text: "Are procedures for handling Personally Identifiable Information (PII) documented?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-010",
            sectionId: "sec-vs-002",
            text: "Describe your key management process for encryption keys.",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
        ],
      },
      {
        id: "sec-vs-003",
        name: "Incident Response",
        order: 3,
        questions: [
          {
            id: "q-vs-011",
            sectionId: "sec-vs-003",
            text: "Does your organization have a documented Incident Response (IR) plan?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-012",
            sectionId: "sec-vs-003",
            text: "Has the IR plan been tested (via tabletop or drill) in the last 12 months?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [
              {
                questionId: "q-vs-011",
                operator: "equals",
                value: "true",
                action: "show",
              },
            ],
          },
          {
            id: "q-vs-013",
            sectionId: "sec-vs-003",
            text: "What is your mean time to detect (MTTD) security incidents (in hours)?",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 720,
            conditions: [],
          },
          {
            id: "q-vs-014",
            sectionId: "sec-vs-003",
            text: "What is your notification timeline for confirmed data breaches?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-vs-014-a", label: "Within 24 hours", value: "24hrs", numericValue: 1.0 },
              { id: "q-vs-014-b", label: "Within 48 hours", value: "48hrs", numericValue: 0.75 },
              { id: "q-vs-014-c", label: "Within 72 hours", value: "72hrs", numericValue: 0.5 },
              { id: "q-vs-014-d", label: "No defined commitment", value: "no-commitment", numericValue: 0.0 },
            ],
            conditions: [],
          },
          {
            id: "q-vs-015",
            sectionId: "sec-vs-003",
            text: "Describe your post-incident review process.",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
        ],
      },
      {
        id: "sec-vs-004",
        name: "Business Continuity",
        order: 4,
        questions: [
          {
            id: "q-vs-016",
            sectionId: "sec-vs-004",
            text: "Does your organization have a documented Business Continuity Plan (BCP)?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-017",
            sectionId: "sec-vs-004",
            text: "What is your Recovery Point Objective (RPO) target in hours?",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 168,
            conditions: [],
          },
          {
            id: "q-vs-018",
            sectionId: "sec-vs-004",
            text: "What is your Recovery Time Objective (RTO) target in hours?",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 168,
            conditions: [],
          },
          {
            id: "q-vs-019",
            sectionId: "sec-vs-004",
            text: "How frequently is disaster recovery testing performed?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-vs-019-a", label: "Monthly", value: "monthly", numericValue: 1.0 },
              { id: "q-vs-019-b", label: "Quarterly", value: "quarterly", numericValue: 0.75 },
              { id: "q-vs-019-c", label: "Semi-annually", value: "semi-annually", numericValue: 0.5 },
              { id: "q-vs-019-d", label: "Annually", value: "annually", numericValue: 0.25 },
              { id: "q-vs-019-e", label: "Never", value: "never", numericValue: 0.0 },
            ],
            conditions: [],
          },
          {
            id: "q-vs-020",
            sectionId: "sec-vs-004",
            text: "Does your organization use geographically redundant infrastructure?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
        ],
      },
      {
        id: "sec-vs-005",
        name: "Data Privacy",
        order: 5,
        questions: [
          {
            id: "q-vs-021",
            sectionId: "sec-vs-005",
            text: "Is a privacy policy publicly published and accessible?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-022",
            sectionId: "sec-vs-005",
            text: "What is your GDPR compliance status?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-vs-022-a", label: "Fully compliant", value: "compliant", numericValue: 1.0 },
              { id: "q-vs-022-b", label: "In progress", value: "in-progress", numericValue: 0.5 },
              { id: "q-vs-022-c", label: "Not applicable", value: "not-applicable", numericValue: 0.75 },
              { id: "q-vs-022-d", label: "Non-compliant", value: "non-compliant", numericValue: 0.0 },
            ],
            conditions: [],
          },
          {
            id: "q-vs-023",
            sectionId: "sec-vs-005",
            text: "Is a data retention and deletion policy defined and enforced?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-vs-024",
            sectionId: "sec-vs-005",
            text: "Describe your process for handling data subject access requests (DSARs).",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
          {
            id: "q-vs-025",
            sectionId: "sec-vs-005",
            text: "Do you disclose all sub-processors to clients upon request?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
        ],
      },
    ],
  };

  // ─── Template 2: Compliance Control Assessment ───────────────────────────────
  const complianceControlTemplate: AssessmentTemplateQuestions = {
    version: 1,
    sections: [
      {
        id: "sec-cc-001",
        name: "Control Design",
        order: 1,
        questions: [
          {
            id: "q-cc-001",
            sectionId: "sec-cc-001",
            text: "Is the control objective clearly documented?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-cc-002",
            sectionId: "sec-cc-001",
            text: "Has a control owner been assigned and acknowledged?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-cc-003",
            sectionId: "sec-cc-001",
            text: "What is the control operating frequency?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-cc-003-a", label: "Continuous", value: "continuous", numericValue: 1.0 },
              { id: "q-cc-003-b", label: "Daily", value: "daily", numericValue: 0.9 },
              { id: "q-cc-003-c", label: "Weekly", value: "weekly", numericValue: 0.75 },
              { id: "q-cc-003-d", label: "Monthly", value: "monthly", numericValue: 0.6 },
              { id: "q-cc-003-e", label: "Quarterly", value: "quarterly", numericValue: 0.4 },
              { id: "q-cc-003-f", label: "Ad-hoc", value: "ad-hoc", numericValue: 0.1 },
            ],
            conditions: [],
          },
          {
            id: "q-cc-004",
            sectionId: "sec-cc-001",
            text: "What is the control type?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-cc-004-a", label: "Preventive", value: "preventive", numericValue: 1.0 },
              { id: "q-cc-004-b", label: "Detective", value: "detective", numericValue: 0.75 },
              { id: "q-cc-004-c", label: "Corrective", value: "corrective", numericValue: 0.5 },
            ],
            conditions: [],
          },
          {
            id: "q-cc-005",
            sectionId: "sec-cc-001",
            text: "What is the level of automation for this control?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-cc-005-a", label: "Fully automated", value: "fully-automated", numericValue: 1.0 },
              { id: "q-cc-005-b", label: "Partially automated", value: "partially-automated", numericValue: 0.6 },
              { id: "q-cc-005-c", label: "Manual", value: "manual", numericValue: 0.2 },
            ],
            conditions: [],
          },
          {
            id: "q-cc-006",
            sectionId: "sec-cc-001",
            text: "Rate the design effectiveness of this control (0=ineffective, 10=fully effective).",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 10,
            conditions: [],
          },
        ],
      },
      {
        id: "sec-cc-002",
        name: "Implementation",
        order: 2,
        questions: [
          {
            id: "q-cc-007",
            sectionId: "sec-cc-002",
            text: "Is the control implemented as designed?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-cc-008",
            sectionId: "sec-cc-002",
            text: "When was the control last fully implemented or updated? (e.g., 2024-01-15)",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
          {
            id: "q-cc-009",
            sectionId: "sec-cc-002",
            text: "When was the control last reviewed? (e.g., 2024-06-01)",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
          {
            id: "q-cc-010",
            sectionId: "sec-cc-002",
            text: "Rate the operating effectiveness of this control (0=not operating, 10=fully effective).",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 10,
            conditions: [],
          },
          {
            id: "q-cc-011",
            sectionId: "sec-cc-002",
            text: "Are compensating controls in place to mitigate deficiencies?",
            type: "boolean",
            weight: 5,
            required: false,
            conditions: [
              {
                questionId: "q-cc-010",
                operator: "greater_than",
                value: 5,
                action: "hide",
              },
            ],
          },
        ],
      },
      {
        id: "sec-cc-003",
        name: "Evidence & Documentation",
        order: 3,
        questions: [
          {
            id: "q-cc-012",
            sectionId: "sec-cc-003",
            text: "Is evidence of control operation available and accessible?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-cc-013",
            sectionId: "sec-cc-003",
            text: "How current is the available evidence?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-cc-013-a", label: "Current (within 30 days)", value: "current", numericValue: 1.0 },
              { id: "q-cc-013-b", label: "Within 90 days", value: "within-90-days", numericValue: 0.75 },
              { id: "q-cc-013-c", label: "Within the last year", value: "within-year", numericValue: 0.5 },
              { id: "q-cc-013-d", label: "Outdated (over 1 year)", value: "outdated", numericValue: 0.1 },
              { id: "q-cc-013-e", label: "No evidence available", value: "none", numericValue: 0.0 },
            ],
            conditions: [],
          },
          {
            id: "q-cc-014",
            sectionId: "sec-cc-003",
            text: "Is control documentation complete, including procedures and responsibilities?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-cc-015",
            sectionId: "sec-cc-003",
            text: "Is an audit trail maintained for control activities?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-cc-016",
            sectionId: "sec-cc-003",
            text: "Describe the quality and completeness of available evidence.",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
        ],
      },
      {
        id: "sec-cc-004",
        name: "Gaps & Remediation",
        order: 4,
        questions: [
          {
            id: "q-cc-017",
            sectionId: "sec-cc-004",
            text: "Have gaps or deficiencies been identified in this control?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-cc-018",
            sectionId: "sec-cc-004",
            text: "What is the severity of identified gaps?",
            type: "multiple_choice",
            weight: 6,
            required: false,
            options: [
              { id: "q-cc-018-a", label: "Critical", value: "critical", numericValue: 0.0 },
              { id: "q-cc-018-b", label: "High", value: "high", numericValue: 0.25 },
              { id: "q-cc-018-c", label: "Medium", value: "medium", numericValue: 0.5 },
              { id: "q-cc-018-d", label: "Low", value: "low", numericValue: 1.0 },
            ],
            conditions: [
              { questionId: "q-cc-017", operator: "equals", value: "true", action: "show" },
            ],
          },
          {
            id: "q-cc-019",
            sectionId: "sec-cc-004",
            text: "Is a remediation plan in place for identified gaps?",
            type: "boolean",
            weight: 5,
            required: false,
            conditions: [
              { questionId: "q-cc-017", operator: "equals", value: "true", action: "show" },
            ],
          },
          {
            id: "q-cc-020",
            sectionId: "sec-cc-004",
            text: "What is the target timeline for gap remediation?",
            type: "multiple_choice",
            weight: 6,
            required: false,
            options: [
              { id: "q-cc-020-a", label: "Within 30 days", value: "30-days", numericValue: 1.0 },
              { id: "q-cc-020-b", label: "Within 60 days", value: "60-days", numericValue: 0.75 },
              { id: "q-cc-020-c", label: "Within 90 days", value: "90-days", numericValue: 0.5 },
              { id: "q-cc-020-d", label: "Within 6 months", value: "6-months", numericValue: 0.25 },
              { id: "q-cc-020-e", label: "No timeline defined", value: "no-timeline", numericValue: 0.0 },
            ],
            conditions: [
              { questionId: "q-cc-019", operator: "equals", value: "true", action: "show" },
            ],
          },
          {
            id: "q-cc-021",
            sectionId: "sec-cc-004",
            text: "Has residual risk from identified gaps been formally accepted?",
            type: "boolean",
            weight: 5,
            required: false,
            conditions: [
              { questionId: "q-cc-017", operator: "equals", value: "true", action: "show" },
            ],
          },
          {
            id: "q-cc-022",
            sectionId: "sec-cc-004",
            text: "Additional comments on gaps, remediation, or risk acceptance.",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
        ],
      },
    ],
  };

  // ─── Template 3: Incident Assessment ────────────────────────────────────────
  const incidentAssessmentTemplate: AssessmentTemplateQuestions = {
    version: 1,
    sections: [
      {
        id: "sec-ia-001",
        name: "Incident Timeline",
        order: 1,
        questions: [
          {
            id: "q-ia-001",
            sectionId: "sec-ia-001",
            text: "When was the incident first detected? (e.g., 2024-01-15T14:30:00Z)",
            type: "text",
            weight: 3,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-002",
            sectionId: "sec-ia-001",
            text: "How long did it take to provide an initial response after detection (in hours)?",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 72,
            conditions: [],
          },
          {
            id: "q-ia-003",
            sectionId: "sec-ia-001",
            text: "How long did it take to contain the incident after detection (in hours)?",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 168,
            conditions: [],
          },
          {
            id: "q-ia-004",
            sectionId: "sec-ia-001",
            text: "What was the total incident resolution time (in hours)?",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 720,
            conditions: [],
          },
          {
            id: "q-ia-005",
            sectionId: "sec-ia-001",
            text: "What category best describes this incident?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-ia-005-a", label: "Data Breach", value: "data-breach", numericValue: 0.0 },
              { id: "q-ia-005-b", label: "System Outage", value: "system-outage", numericValue: 0.25 },
              { id: "q-ia-005-c", label: "Unauthorized Access", value: "unauthorized-access", numericValue: 0.1 },
              { id: "q-ia-005-d", label: "Malware", value: "malware", numericValue: 0.1 },
              { id: "q-ia-005-e", label: "Phishing", value: "phishing", numericValue: 0.2 },
              { id: "q-ia-005-f", label: "Other", value: "other", numericValue: 0.5 },
            ],
            conditions: [],
          },
        ],
      },
      {
        id: "sec-ia-002",
        name: "Impact Analysis",
        order: 2,
        questions: [
          {
            id: "q-ia-006",
            sectionId: "sec-ia-002",
            text: "Was any data compromised, exfiltrated, or destroyed?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-007",
            sectionId: "sec-ia-002",
            text: "Estimated number of records or data subjects affected.",
            type: "numeric",
            weight: 7,
            required: false,
            numericMin: 0,
            numericMax: 10000000,
            conditions: [],
          },
          {
            id: "q-ia-008",
            sectionId: "sec-ia-002",
            text: "Has a financial impact estimate been completed?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-009",
            sectionId: "sec-ia-002",
            text: "Is regulatory notification required (e.g., GDPR Article 33, HIPAA Breach Rule)?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-010",
            sectionId: "sec-ia-002",
            text: "Is customer or end-user notification required?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
        ],
      },
      {
        id: "sec-ia-003",
        name: "Response Effectiveness",
        order: 3,
        questions: [
          {
            id: "q-ia-011",
            sectionId: "sec-ia-003",
            text: "Was the incident response plan followed during the incident?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-012",
            sectionId: "sec-ia-003",
            text: "Were escalation procedures followed as defined?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-013",
            sectionId: "sec-ia-003",
            text: "Rate the effectiveness of communications during the incident (0=ineffective, 10=excellent).",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 10,
            conditions: [],
          },
          {
            id: "q-ia-014",
            sectionId: "sec-ia-003",
            text: "Rate the effectiveness of containment measures (0=ineffective, 10=fully effective).",
            type: "numeric",
            weight: 7,
            required: true,
            numericMin: 0,
            numericMax: 10,
            conditions: [],
          },
          {
            id: "q-ia-015",
            sectionId: "sec-ia-003",
            text: "Was external support (e.g., IR firm, legal counsel, MSSP) engaged?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
        ],
      },
      {
        id: "sec-ia-004",
        name: "Lessons Learned",
        order: 4,
        questions: [
          {
            id: "q-ia-016",
            sectionId: "sec-ia-004",
            text: "Has the root cause of the incident been identified?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-017",
            sectionId: "sec-ia-004",
            text: "Describe the identified root cause.",
            type: "text",
            weight: 3,
            required: false,
            conditions: [
              { questionId: "q-ia-016", operator: "equals", value: "true", action: "show" },
            ],
          },
          {
            id: "q-ia-018",
            sectionId: "sec-ia-004",
            text: "Have preventive measures been implemented to avoid recurrence?",
            type: "boolean",
            weight: 5,
            required: true,
            conditions: [],
          },
          {
            id: "q-ia-019",
            sectionId: "sec-ia-004",
            text: "Describe the process or policy changes documented as a result of this incident.",
            type: "text",
            weight: 3,
            required: false,
            conditions: [],
          },
          {
            id: "q-ia-020",
            sectionId: "sec-ia-004",
            text: "What is the likelihood of this incident recurring?",
            type: "multiple_choice",
            weight: 6,
            required: true,
            options: [
              { id: "q-ia-020-a", label: "Very likely", value: "very-likely", numericValue: 0.0 },
              { id: "q-ia-020-b", label: "Likely", value: "likely", numericValue: 0.25 },
              { id: "q-ia-020-c", label: "Unlikely", value: "unlikely", numericValue: 0.75 },
              { id: "q-ia-020-d", label: "Very unlikely", value: "very-unlikely", numericValue: 1.0 },
            ],
            conditions: [],
          },
        ],
      },
    ],
  };

  // Upsert all 3 templates
  const templatesToSeed = [
    {
      title: "Vendor Security Assessment",
      description: "[PREBUILT] Comprehensive vendor security assessment covering access control, encryption, incident response, business continuity, and data privacy. Inspired by SIG Lite.",
      questions: vendorSecurityTemplate,
      contextType: "vendor" as const,
    },
    {
      title: "Compliance Control Assessment",
      description: "[PREBUILT] Control effectiveness assessment for ISO 27001-aligned compliance frameworks. Evaluates control design, implementation, evidence quality, and remediation status.",
      questions: complianceControlTemplate,
      contextType: "framework" as const,
    },
    {
      title: "Incident Assessment",
      description: "[PREBUILT] Post-incident assessment covering timeline, impact analysis, response effectiveness, root cause, and lessons learned.",
      questions: incidentAssessmentTemplate,
      contextType: "vendor" as const,
    },
  ];

  for (const tmpl of templatesToSeed) {
    const [existing] = await db
      .select({ id: assessmentTemplatesTable.id })
      .from(assessmentTemplatesTable)
      .where(
        and(
          eq(assessmentTemplatesTable.tenantId, tenantId),
          eq(assessmentTemplatesTable.title, tmpl.title),
        ),
      )
      .limit(1);

    if (existing) {
      console.log(`[Seed] Template "${tmpl.title}" already exists for tenant ${tenantId}, skipping`);
      continue;
    }

    await db.insert(assessmentTemplatesTable).values({
      tenantId,
      title: tmpl.title,
      description: tmpl.description,
      questions: tmpl.questions,
      contextType: tmpl.contextType,
      version: 1,
    });

    console.log(`[Seed] Created pre-built template: "${tmpl.title}" for tenant ${tenantId}`);
  }
}
