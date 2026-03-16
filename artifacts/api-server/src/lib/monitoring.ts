import { db, alertsTable, krisTable, reviewCyclesTable, documentsTable, controlTestsTable, vendorsTable, controlsTable, controlRequirementMapsTable, frameworkRequirementsTable, frameworksTable } from "@workspace/db";
import { eq, and, sql, lt, inArray } from "drizzle-orm";
import { recordAuditDirect } from "./audit";

const ESCALATION_WINDOW_MS = 4 * 60 * 60 * 1000;

async function getTenantIds(): Promise<string[]> {
  const rows = await db.selectDistinct({ tenantId: krisTable.tenantId }).from(krisTable);
  const vendorRows = await db.selectDistinct({ tenantId: vendorsTable.tenantId }).from(vendorsTable);
  const ids = new Set([...rows.map(r => r.tenantId), ...vendorRows.map(r => r.tenantId)]);
  return Array.from(ids);
}

async function createAlert(tenantId: string, type: string, title: string, severity: "critical" | "high" | "medium" | "low", description: string, context: Record<string, unknown> = {}) {
  const [alert] = await db.insert(alertsTable).values({
    tenantId,
    type,
    title,
    description,
    severity,
    context,
  }).returning();
  return alert;
}

export async function checkKriBreaches() {
  const kris = await db.select().from(krisTable)
    .where(sql`${krisTable.currentValue} IS NOT NULL AND ${krisTable.criticalThreshold} IS NOT NULL`);

  let alertCount = 0;
  for (const kri of kris) {
    const val = Number(kri.currentValue);
    const critical = Number(kri.criticalThreshold);
    const warning = kri.warningThreshold ? Number(kri.warningThreshold) : null;

    if (val >= critical) {
      await createAlert(kri.tenantId, "kri_breach", `KRI breach: ${kri.name}`, "critical",
        `KRI "${kri.name}" value ${val} exceeds critical threshold ${critical}`,
        { kriId: kri.id, riskId: kri.riskId, value: val, threshold: critical });
      alertCount++;
    } else if (warning && val >= warning) {
      await createAlert(kri.tenantId, "kri_breach", `KRI warning: ${kri.name}`, "high",
        `KRI "${kri.name}" value ${val} exceeds warning threshold ${warning}`,
        { kriId: kri.id, riskId: kri.riskId, value: val, threshold: warning });
      alertCount++;
    }
  }
  return alertCount;
}

export async function checkOverdueReviews() {
  const now = new Date();
  const overdueReviews = await db.select().from(reviewCyclesTable)
    .where(and(
      inArray(reviewCyclesTable.status, ["scheduled", "in_progress"]),
      lt(reviewCyclesTable.dueDate, now),
    ));

  let alertCount = 0;
  for (const review of overdueReviews) {
    await createAlert(review.tenantId, "overdue_review", `Overdue risk review`, "medium",
      `Risk review due on ${review.dueDate.toISOString().split("T")[0]} is overdue`,
      { reviewId: review.id, riskId: review.riskId });
    alertCount++;
  }
  return alertCount;
}

export async function checkExpiredDocuments() {
  const failedDocs = await db.select().from(documentsTable)
    .where(eq(documentsTable.status, "failed"));

  let alertCount = 0;
  for (const doc of failedDocs) {
    await createAlert(doc.tenantId, "document_issue", `Document processing failed: ${doc.fileName}`, "medium",
      `Document "${doc.fileName}" has failed processing`,
      { documentId: doc.id, vendorId: doc.vendorId });
    alertCount++;
  }
  return alertCount;
}

export async function checkFailedControlTests() {
  const failedTests = await db.select().from(controlTestsTable)
    .where(eq(controlTestsTable.result, "fail"));

  let alertCount = 0;
  for (const test of failedTests) {
    await createAlert(test.tenantId, "control_test_failure", `Control test failed`, "high",
      `A control test has failed`,
      { testId: test.id, controlId: test.controlId });
    alertCount++;
  }
  return alertCount;
}

export async function checkVendorStatusIssues() {
  const suspendedVendors = await db.select().from(vendorsTable)
    .where(eq(vendorsTable.status, "suspended"));

  let alertCount = 0;
  for (const vendor of suspendedVendors) {
    await createAlert(vendor.tenantId, "vendor_status", `Vendor suspended: ${vendor.name}`, "high",
      `Vendor "${vendor.name}" is currently suspended`,
      { vendorId: vendor.id });
    alertCount++;
  }
  return alertCount;
}

export async function checkComplianceDrift() {
  const frameworks = await db.select().from(frameworksTable);
  let alertCount = 0;

  for (const fw of frameworks) {
    const totalReqs = await db.select({ count: sql<number>`count(*)::int` })
      .from(frameworkRequirementsTable)
      .where(eq(frameworkRequirementsTable.frameworkId, fw.id));

    const coveredReqs = await db.select({ count: sql<number>`count(DISTINCT ${controlRequirementMapsTable.requirementId})::int` })
      .from(controlRequirementMapsTable)
      .innerJoin(frameworkRequirementsTable, eq(controlRequirementMapsTable.requirementId, frameworkRequirementsTable.id))
      .innerJoin(controlsTable, eq(controlRequirementMapsTable.controlId, controlsTable.id))
      .where(and(
        eq(frameworkRequirementsTable.frameworkId, fw.id),
        eq(controlsTable.status, "active"),
      ));

    const total = totalReqs[0].count;
    const covered = coveredReqs[0].count;

    if (total > 0) {
      const coveragePercent = (covered / total) * 100;
      if (coveragePercent < 50) {
        const tenantIds = await db.selectDistinct({ tenantId: controlsTable.tenantId }).from(controlsTable);
        for (const { tenantId } of tenantIds) {
          await createAlert(tenantId, "compliance_drift", `Low compliance coverage: ${fw.name}`, "high",
            `Framework "${fw.name}" has only ${coveragePercent.toFixed(1)}% requirement coverage (${covered}/${total})`,
            { frameworkId: fw.id, coveragePercent, covered, total });
          alertCount++;
        }
      }
    }
  }
  return alertCount;
}

export async function escalateUnacknowledgedAlerts() {
  const cutoff = new Date(Date.now() - ESCALATION_WINDOW_MS);
  const unacked = await db.select().from(alertsTable)
    .where(and(
      eq(alertsTable.status, "active"),
      eq(alertsTable.severity, "critical"),
      lt(alertsTable.createdAt, cutoff),
    ));

  let escalatedCount = 0;
  for (const alert of unacked) {
    await db.update(alertsTable).set({
      status: "escalated",
      updatedAt: new Date(),
    }).where(eq(alertsTable.id, alert.id));
    await recordAuditDirect(alert.tenantId, null, "escalate", "alert", alert.id);
    escalatedCount++;
  }
  return escalatedCount;
}

export async function runAllMonitoringChecks() {
  console.log("[Monitoring] Running all checks...");

  const results = {
    kriBreaches: await checkKriBreaches(),
    overdueReviews: await checkOverdueReviews(),
    expiredDocuments: await checkExpiredDocuments(),
    failedControlTests: await checkFailedControlTests(),
    vendorStatusIssues: await checkVendorStatusIssues(),
    complianceDrift: await checkComplianceDrift(),
    escalations: await escalateUnacknowledgedAlerts(),
  };

  console.log("[Monitoring] Check results:", results);
  return results;
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startMonitoringScheduler(intervalMs = 24 * 60 * 60 * 1000) {
  if (schedulerInterval) return;

  runAllMonitoringChecks().catch(err => console.error("[Monitoring] Initial check failed:", err));

  schedulerInterval = setInterval(() => {
    runAllMonitoringChecks().catch(err => console.error("[Monitoring] Scheduled check failed:", err));
  }, intervalMs);

  console.log(`[Monitoring] Scheduler started (interval: ${intervalMs}ms)`);
}

export function stopMonitoringScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
