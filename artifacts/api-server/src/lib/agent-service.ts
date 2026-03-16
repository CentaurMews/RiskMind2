import { eq, and, sql, desc, gt, lt, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  risksTable,
  krisTable,
  vendorsTable,
  signalsTable,
  alertsTable,
  controlsTable,
  frameworksTable,
  frameworkRequirementsTable,
  controlRequirementMapsTable,
  controlTestsTable,
  agentRunsTable,
  agentFindingsTable,
} from "@workspace/db";
import { complete, isAvailable } from "./llm-service";
import { recordAuditDirect } from "./audit";

interface TenantAgentConfig {
  agentEnabled?: boolean;
  agentPolicyTier?: "observe" | "advisory" | "active";
  agentSchedule?: string;
}

interface LinkedEntity {
  type: string;
  id: string;
  label: string;
}

interface Finding {
  type: "cascade_chain" | "cluster" | "predictive_signal" | "anomaly" | "cross_domain" | "recommendation";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  narrative: string;
  linkedEntities: LinkedEntity[];
  proposedAction?: Record<string, unknown>;
}

interface ObservationData {
  risks: Array<Record<string, unknown>>;
  kris: Array<Record<string, unknown>>;
  vendors: Array<Record<string, unknown>>;
  signals: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  controls: Array<Record<string, unknown>>;
  frameworks: Array<Record<string, unknown>>;
  unmappedRequirements: Array<Record<string, unknown>>;
  failedControlTests: Array<Record<string, unknown>>;
}

export function getTenantAgentConfig(settings: unknown): TenantAgentConfig {
  if (!settings || typeof settings !== "object") return {};
  const s = settings as Record<string, unknown>;
  return {
    agentEnabled: typeof s.agentEnabled === "boolean" ? s.agentEnabled : undefined,
    agentPolicyTier: ["observe", "advisory", "active"].includes(s.agentPolicyTier as string)
      ? (s.agentPolicyTier as TenantAgentConfig["agentPolicyTier"])
      : undefined,
    agentSchedule: typeof s.agentSchedule === "string" ? s.agentSchedule : undefined,
  };
}

async function observe(tenantId: string): Promise<ObservationData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [risks, kris, vendors, signals, alerts, controls, frameworks] = await Promise.all([
    db.select({
      id: risksTable.id, title: risksTable.title, description: risksTable.description,
      category: risksTable.category, status: risksTable.status,
      likelihood: risksTable.likelihood, impact: risksTable.impact,
      residualLikelihood: risksTable.residualLikelihood, residualImpact: risksTable.residualImpact,
    }).from(risksTable).where(eq(risksTable.tenantId, tenantId)),

    db.select({
      id: krisTable.id, riskId: krisTable.riskId, name: krisTable.name,
      currentValue: krisTable.currentValue, warningThreshold: krisTable.warningThreshold,
      criticalThreshold: krisTable.criticalThreshold, unit: krisTable.unit,
    }).from(krisTable).where(eq(krisTable.tenantId, tenantId)),

    db.select({
      id: vendorsTable.id, name: vendorsTable.name, tier: vendorsTable.tier,
      status: vendorsTable.status, riskScore: vendorsTable.riskScore, category: vendorsTable.category,
    }).from(vendorsTable).where(eq(vendorsTable.tenantId, tenantId)),

    db.select({
      id: signalsTable.id, source: signalsTable.source, content: signalsTable.content,
      status: signalsTable.status, classification: signalsTable.classification,
      confidence: signalsTable.confidence,
    }).from(signalsTable)
      .where(and(eq(signalsTable.tenantId, tenantId), gt(signalsTable.createdAt, thirtyDaysAgo))),

    db.select({
      id: alertsTable.id, type: alertsTable.type, title: alertsTable.title,
      severity: alertsTable.severity, status: alertsTable.status, context: alertsTable.context,
    }).from(alertsTable)
      .where(and(eq(alertsTable.tenantId, tenantId), inArray(alertsTable.status, ["active", "escalated"]))),

    db.select({
      id: controlsTable.id, title: controlsTable.title, status: controlsTable.status,
    }).from(controlsTable).where(eq(controlsTable.tenantId, tenantId)),

    db.select({
      id: frameworksTable.id, name: frameworksTable.name, type: frameworksTable.type,
    }).from(frameworksTable).where(eq(frameworksTable.tenantId, tenantId)),
  ]);

  const allReqIds = frameworks.map(f => f.id);
  let unmappedRequirements: Array<Record<string, unknown>> = [];
  if (allReqIds.length > 0) {
    unmappedRequirements = await db.select({
      id: frameworkRequirementsTable.id,
      frameworkId: frameworkRequirementsTable.frameworkId,
      code: frameworkRequirementsTable.code,
      title: frameworkRequirementsTable.title,
    }).from(frameworkRequirementsTable)
      .where(and(
        eq(frameworkRequirementsTable.tenantId, tenantId),
        sql`${frameworkRequirementsTable.id} NOT IN (SELECT requirement_id FROM control_requirement_maps)`,
      ));
  }

  let failedControlTests: Array<Record<string, unknown>> = [];
  if (controls.length > 0) {
    failedControlTests = await db.select({
      id: controlTestsTable.id, controlId: controlTestsTable.controlId,
      result: controlTestsTable.result, notes: controlTestsTable.notes,
      testedAt: controlTestsTable.testedAt,
    }).from(controlTestsTable)
      .where(and(
        eq(controlTestsTable.tenantId, tenantId),
        inArray(controlTestsTable.result, ["fail", "partial"]),
        gt(controlTestsTable.testedAt, thirtyDaysAgo),
      ));
  }

  return { risks, kris, vendors, signals, alerts, controls, frameworks, unmappedRequirements, failedControlTests };
}

function detectCascadeChains(data: ObservationData): Finding[] {
  const findings: Finding[] = [];

  const krisByRisk = new Map<string, Array<Record<string, unknown>>>();
  for (const kri of data.kris) {
    const riskId = kri.riskId as string;
    if (!krisByRisk.has(riskId)) krisByRisk.set(riskId, []);
    krisByRisk.get(riskId)!.push(kri);
  }

  const failedByControl = new Map<string, Array<Record<string, unknown>>>();
  for (const t of data.failedControlTests) {
    const cid = t.controlId as string;
    if (!failedByControl.has(cid)) failedByControl.set(cid, []);
    failedByControl.get(cid)!.push(t);
  }

  for (const risk of data.risks) {
    const riskId = risk.id as string;
    const riskKris = krisByRisk.get(riskId) || [];
    const breachedKris = riskKris.filter(k => {
      const val = Number(k.currentValue);
      const crit = Number(k.criticalThreshold);
      return val >= crit;
    });

    if (breachedKris.length === 0) continue;

    const activeAlerts = data.alerts.filter(a => {
      const ctx = a.context as Record<string, unknown> | null;
      return ctx && ctx.riskId === riskId;
    });

    if (activeAlerts.length === 0) continue;

    const entities: LinkedEntity[] = [
      { type: "risk", id: riskId, label: risk.title as string },
      ...breachedKris.map(k => ({ type: "kri", id: k.id as string, label: k.name as string })),
      ...activeAlerts.map(a => ({ type: "alert", id: a.id as string, label: a.title as string })),
    ];

    findings.push({
      type: "cascade_chain",
      severity: "high",
      title: `Cascade: ${risk.title} — KRI breach + active alerts`,
      narrative: `Risk "${risk.title}" has ${breachedKris.length} KRI(s) breaching critical thresholds with ${activeAlerts.length} active alert(s). This indicates an escalating risk pattern requiring immediate attention.`,
      linkedEntities: entities,
    });
  }

  const gapsByFramework = new Map<string, Array<Record<string, unknown>>>();
  for (const req of data.unmappedRequirements) {
    const fwId = req.frameworkId as string;
    if (!gapsByFramework.has(fwId)) gapsByFramework.set(fwId, []);
    gapsByFramework.get(fwId)!.push(req);
  }

  for (const [fwId, gaps] of gapsByFramework) {
    const framework = data.frameworks.find(f => f.id === fwId);
    if (!framework) continue;
    if (gaps.length < 3) continue;

    const topGaps = gaps.slice(0, 5);
    const entities: LinkedEntity[] = [
      { type: "framework", id: fwId, label: framework.name as string },
      ...topGaps.map(g => ({
        type: "framework_requirement" as const,
        id: g.id as string,
        label: `${g.code}: ${g.title}`,
      })),
    ];

    if (failedByControl.size > 0) {
      for (const [cid, tests] of failedByControl) {
        const ctrl = data.controls.find(c => c.id === cid);
        if (ctrl) {
          entities.push({ type: "control", id: cid, label: ctrl.title as string });
        }
      }
    }

    findings.push({
      type: "cascade_chain",
      severity: gaps.length >= 10 ? "high" : "medium",
      title: `Compliance gap cluster: ${framework.name} — ${gaps.length} unmapped requirements`,
      narrative: `Framework "${framework.name}" has ${gaps.length} requirement(s) with no mapped control. ${failedByControl.size > 0 ? `Additionally, ${failedByControl.size} existing control(s) have recent test failures, indicating weakened coverage.` : ""} This creates a systemic compliance gap that increases regulatory risk.`,
      linkedEntities: entities,
    });
  }

  return findings;
}

async function detectClusters(tenantId: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const clusters = await db.execute(sql`
      WITH risk_embeddings AS (
        SELECT id, title, category, embedding
        FROM risks
        WHERE tenant_id = ${tenantId} AND embedding IS NOT NULL
      ),
      signal_embeddings AS (
        SELECT id, content, classification, embedding
        FROM signals
        WHERE tenant_id = ${tenantId} AND embedding IS NOT NULL
          AND created_at > now() - interval '30 days'
      ),
      similarities AS (
        SELECT
          r.id AS risk_id, r.title AS risk_title, r.category,
          s.id AS signal_id, s.content AS signal_content, s.classification,
          1 - (r.embedding <=> s.embedding) AS similarity
        FROM risk_embeddings r
        CROSS JOIN signal_embeddings s
        WHERE 1 - (r.embedding <=> s.embedding) > 0.75
      )
      SELECT risk_id, risk_title, category,
        json_agg(json_build_object(
          'signalId', signal_id,
          'content', LEFT(signal_content, 200),
          'classification', classification,
          'similarity', ROUND(similarity::numeric, 3)
        ) ORDER BY similarity DESC) AS related_signals,
        COUNT(*) AS signal_count
      FROM similarities
      GROUP BY risk_id, risk_title, category
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);

    for (const row of clusters.rows as Array<Record<string, unknown>>) {
      const signals = row.related_signals as Array<Record<string, unknown>>;
      const entities: LinkedEntity[] = [
        { type: "risk", id: row.risk_id as string, label: row.risk_title as string },
        ...signals.slice(0, 5).map(s => ({
          type: "signal",
          id: s.signalId as string,
          label: (s.content as string).substring(0, 80),
        })),
      ];

      findings.push({
        type: "cluster",
        severity: (signals.length >= 5 ? "high" : "medium") as Finding["severity"],
        title: `Threat cluster: ${row.risk_title} — ${row.signal_count} correlated signals`,
        narrative: `Risk "${row.risk_title}" (${row.category}) has ${row.signal_count} semantically correlated signal(s) detected in the past 30 days. These form a coherent threat cluster that may indicate an emerging risk pattern not yet explicitly linked in the data model.`,
        linkedEntities: entities,
      });
    }
  } catch (err) {
    console.error("[Agent] Cluster detection error (pgvector may not have data):", err instanceof Error ? err.message : err);
  }

  return findings;
}

async function detectPredictiveSignals(tenantId: string, data: ObservationData): Promise<Finding[]> {
  const findings: Finding[] = [];

  const krisByRisk = new Map<string, Array<Record<string, unknown>>>();
  for (const kri of data.kris) {
    const riskId = kri.riskId as string;
    if (!krisByRisk.has(riskId)) krisByRisk.set(riskId, []);
    krisByRisk.get(riskId)!.push(kri);
  }

  let historicalValues: Array<{ kriId: string; value: number; timestamp: Date }> = [];
  try {
    const rows = await db.execute(sql`
      SELECT
        (payload->>'kriId')::text AS kri_id,
        (payload->>'value')::numeric AS value,
        created_at AS timestamp
      FROM audit_events
      WHERE tenant_id = ${tenantId}
        AND action IN ('kri_updated', 'kri_breach')
        AND payload->>'kriId' IS NOT NULL
        AND payload->>'value' IS NOT NULL
        AND created_at > now() - interval '90 days'
      ORDER BY created_at ASC
    `);
    historicalValues = (rows.rows as Array<Record<string, unknown>>).map(r => ({
      kriId: r.kri_id as string,
      value: Number(r.value),
      timestamp: new Date(r.timestamp as string),
    }));
  } catch {
    // audit_events may not have KRI history yet
  }

  const historyByKri = new Map<string, Array<{ value: number; timestamp: Date }>>();
  for (const h of historicalValues) {
    if (!historyByKri.has(h.kriId)) historyByKri.set(h.kriId, []);
    historyByKri.get(h.kriId)!.push({ value: h.value, timestamp: h.timestamp });
  }

  for (const [riskId, kris] of krisByRisk) {
    const risk = data.risks.find(r => r.id === riskId);
    if (!risk) continue;

    const trendingKris: Array<{ kri: Record<string, unknown>; trendInfo: string }> = [];

    for (const kri of kris) {
      const val = Number(kri.currentValue);
      const critical = Number(kri.criticalThreshold);
      const warning = kri.warningThreshold ? Number(kri.warningThreshold) : null;
      if (!critical || val >= critical) continue;

      const history = historyByKri.get(kri.id as string) || [];

      if (history.length >= 3) {
        const points = history.slice(-10);
        const n = points.length;
        const meanX = (n - 1) / 2;
        const meanY = points.reduce((s, p) => s + p.value, 0) / n;
        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n; i++) {
          numerator += (i - meanX) * (points[i].value - meanY);
          denominator += (i - meanX) * (i - meanX);
        }
        const slope = denominator > 0 ? numerator / denominator : 0;

        if (slope > 0) {
          const stepsToThreshold = (critical - val) / slope;
          if (stepsToThreshold > 0 && stepsToThreshold <= 10) {
            trendingKris.push({
              kri,
              trendInfo: `slope=${slope.toFixed(2)}/period, est. ${Math.ceil(stepsToThreshold)} periods to breach`,
            });
          }
        }
      } else if (warning && val >= warning * 0.8 && val < critical) {
        const pct = ((val - (warning * 0.8)) / (critical - (warning * 0.8)) * 100).toFixed(0);
        trendingKris.push({
          kri,
          trendInfo: `at ${pct}% of warning-to-critical range`,
        });
      }
    }

    if (trendingKris.length >= 2) {
      const details = trendingKris.map(t =>
        `"${t.kri.name}" (${t.kri.currentValue}/${t.kri.criticalThreshold} ${t.kri.unit}): ${t.trendInfo}`
      ).join("; ");

      findings.push({
        type: "predictive_signal",
        severity: "medium",
        title: `Trending KRIs for risk: ${risk.title}`,
        narrative: `Risk "${risk.title}" has ${trendingKris.length} KRI(s) trending toward thresholds. ${details}. Proactive mitigation is recommended before breach occurs.`,
        linkedEntities: [
          { type: "risk", id: riskId, label: risk.title as string },
          ...trendingKris.map(t => ({
            type: "kri",
            id: t.kri.id as string,
            label: `${t.kri.name}: ${t.kri.currentValue}/${t.kri.criticalThreshold} ${t.kri.unit}`,
          })),
        ],
        proposedAction: {
          type: "create_signal",
          content: `Predictive: ${trendingKris.length} KRIs for "${risk.title}" approaching thresholds`,
          classification: "predictive_kri_trend",
        },
      });
    }
  }

  return findings;
}

async function reason(tenantId: string, data: ObservationData, localFindings: Finding[]): Promise<Finding[]> {
  const summary = {
    risks: { total: data.risks.length, open: data.risks.filter(r => r.status === "open").length, critical: data.risks.filter(r => (Number(r.likelihood) * Number(r.impact)) >= 20).length },
    kris: { total: data.kris.length, breaching: data.kris.filter(k => Number(k.currentValue) >= Number(k.criticalThreshold)).length },
    vendors: { total: data.vendors.length, critical: data.vendors.filter(v => v.tier === "critical").length, suspended: data.vendors.filter(v => v.status === "suspended").length },
    signals: { total: data.signals.length, pending: data.signals.filter(s => s.status === "pending").length },
    alerts: { total: data.alerts.length, critical: data.alerts.filter(a => a.severity === "critical").length, escalated: data.alerts.filter(a => a.status === "escalated").length },
    controls: { total: data.controls.length, inactive: data.controls.filter(c => c.status === "inactive").length },
    compliance: { unmappedRequirements: data.unmappedRequirements.length, failedTests: data.failedControlTests.length },
  };

  const prompt = `You are the Autonomous Risk Intelligence Agent for an enterprise risk management platform. Analyze the following cross-domain data and identify insights that a human analyst would likely miss.

## Current State Summary
${JSON.stringify(summary, null, 2)}

## Local Analysis Already Performed
${localFindings.length} findings already detected locally:
${localFindings.map(f => `- [${f.type}] ${f.title}`).join("\n")}

## Detailed Data
### Open Risks (top 20)
${JSON.stringify(data.risks.slice(0, 20), null, 2)}

### KRI Values
${JSON.stringify(data.kris, null, 2)}

### Active Alerts
${JSON.stringify(data.alerts.slice(0, 15), null, 2)}

### Recent Signals (pending)
${JSON.stringify(data.signals.filter(s => s.status === "pending").slice(0, 10), null, 2)}

### Vendor Status
${JSON.stringify(data.vendors, null, 2)}

### Compliance Gaps (unmapped requirements)
${JSON.stringify(data.unmappedRequirements.slice(0, 20), null, 2)}

## Instructions
Identify up to 5 additional cross-domain findings NOT already covered by the local analysis above. Focus on:
1. Cross-domain correlations (e.g., vendor issues that could impact compliance, signals that relate to open risks)
2. Anomalies (unexpected patterns in the data)
3. Recommendations for risk reduction

Respond ONLY with valid JSON:
{"findings":[{"type":"cross_domain|anomaly|recommendation","severity":"critical|high|medium|low|info","title":"...","narrative":"A detailed explanation of the finding and why it matters...","linkedEntities":[{"type":"risk|vendor|signal|alert|control|framework","id":"uuid","label":"name"}]}]}

If no additional findings, respond: {"findings":[]}`;

  const response = await complete(tenantId, {
    messages: [
      { role: "system", content: "You are an enterprise risk intelligence analyst. Respond only with valid JSON." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 4000,
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    const llmFindings: Finding[] = (parsed.findings || [])
      .filter((f: Record<string, unknown>) => f.title && f.narrative)
      .map((f: Record<string, unknown>) => ({
        type: (["cross_domain", "anomaly", "recommendation"].includes(f.type as string) ? f.type : "cross_domain") as Finding["type"],
        severity: (["critical", "high", "medium", "low", "info"].includes(f.severity as string) ? f.severity : "medium") as Finding["severity"],
        title: String(f.title),
        narrative: String(f.narrative),
        linkedEntities: Array.isArray(f.linkedEntities) ? (f.linkedEntities as LinkedEntity[]) : [],
      }));
    return llmFindings.slice(0, 5);
  } catch (err) {
    console.error("[Agent] Failed to parse LLM reasoning response:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function act(
  tenantId: string,
  runId: string,
  findings: Finding[],
  policyTier: "observe" | "advisory" | "active",
): Promise<number> {
  let savedCount = 0;

  for (const finding of findings) {
    const [saved] = await db.insert(agentFindingsTable).values({
      tenantId,
      runId,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      narrative: finding.narrative,
      linkedEntities: finding.linkedEntities,
      proposedAction: finding.proposedAction || null,
      status: "pending_review",
    }).returning();

    await recordAuditDirect(tenantId, null, "agent_finding_created", "agent_finding", saved.id, {
      agentRunId: runId,
      type: finding.type,
      severity: finding.severity,
      policyTier,
    });

    if (policyTier === "advisory" && finding.proposedAction) {
      const action = finding.proposedAction as Record<string, unknown>;
      if (action.type === "create_signal") {
        try {
          const [draftSignal] = await db.insert(signalsTable).values({
            tenantId,
            source: "agent",
            content: String(action.content || finding.title),
            status: "pending",
            classification: String(action.classification || "agent_generated"),
            confidence: 0.7,
          }).returning();

          await recordAuditDirect(tenantId, null, "agent_draft_signal_created", "signal", draftSignal.id, {
            agentRunId: runId,
            findingId: saved.id,
            status: "pending",
          });
        } catch (err) {
          console.error("[Agent] Failed to create draft signal:", err instanceof Error ? err.message : err);
        }
      }
    }

    if (policyTier === "active" && finding.severity === "critical") {
      try {
        const [existing] = await db.select({ id: alertsTable.id }).from(alertsTable)
          .where(and(
            eq(alertsTable.tenantId, tenantId),
            eq(alertsTable.type, "agent_finding"),
            eq(alertsTable.title, finding.title),
            eq(alertsTable.status, "active"),
          )).limit(1);

        if (!existing) {
          await db.insert(alertsTable).values({
            tenantId,
            type: "agent_finding",
            title: finding.title,
            description: finding.narrative,
            severity: finding.severity === "critical" ? "critical" : "high",
            context: { agentRunId: runId, findingId: saved.id, linkedEntities: finding.linkedEntities },
          });

          await recordAuditDirect(tenantId, null, "agent_auto_alert", "alert", saved.id, {
            agentRunId: runId,
            severity: finding.severity,
          });
        }
      } catch (err) {
        console.error("[Agent] Failed to create auto-alert:", err instanceof Error ? err.message : err);
      }
    }

    savedCount++;
  }

  return savedCount;
}

export async function runAgentCycle(tenantId: string, policyTier: "observe" | "advisory" | "active" = "observe"): Promise<string> {
  const startTime = Date.now();

  const [run] = await db.insert(agentRunsTable).values({
    tenantId,
    policyTier,
    status: "running",
    startedAt: new Date(),
  }).returning();

  try {
    const available = await isAvailable(tenantId);

    const data = await observe(tenantId);

    const cascadeFindings = detectCascadeChains(data);
    const clusterFindings = await detectClusters(tenantId);
    const predictiveFindings = await detectPredictiveSignals(tenantId, data);

    let localFindings = [...cascadeFindings, ...clusterFindings, ...predictiveFindings];

    let llmFindings: Finding[] = [];
    let model: string | null = null;
    let tokenEstimate = 0;

    if (available) {
      try {
        llmFindings = await reason(tenantId, data, localFindings);
        model = "configured";
        tokenEstimate = JSON.stringify(data).length / 4;
      } catch (err) {
        console.error("[Agent] LLM reasoning failed, continuing with local findings:", err instanceof Error ? err.message : err);
      }
    } else {
      console.log("[Agent] LLM not available, running with local analysis only");
    }

    const allFindings = [...localFindings, ...llmFindings];

    const savedCount = await act(tenantId, run.id, allFindings, policyTier);

    const durationMs = Date.now() - startTime;
    await db.update(agentRunsTable).set({
      status: "completed",
      model,
      tokenCount: tokenEstimate,
      durationMs,
      findingCount: savedCount,
      completedAt: new Date(),
      context: {
        observationSummary: {
          risks: data.risks.length,
          kris: data.kris.length,
          vendors: data.vendors.length,
          signals: data.signals.length,
          alerts: data.alerts.length,
          controls: data.controls.length,
          unmappedRequirements: data.unmappedRequirements.length,
        },
        localFindings: localFindings.length,
        llmFindings: llmFindings.length,
        llmAvailable: available,
      },
    }).where(eq(agentRunsTable.id, run.id));

    await recordAuditDirect(tenantId, null, "agent_run_completed", "agent_run", run.id, {
      policyTier,
      findingCount: savedCount,
      durationMs,
      llmAvailable: available,
    });

    console.log(`[Agent] Run ${run.id} completed for tenant ${tenantId}: ${savedCount} findings in ${durationMs}ms`);
    return run.id;

  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await db.update(agentRunsTable).set({
      status: "failed",
      error: errorMsg,
      durationMs,
      completedAt: new Date(),
    }).where(eq(agentRunsTable.id, run.id));

    await recordAuditDirect(tenantId, null, "agent_run_failed", "agent_run", run.id, {
      error: errorMsg,
      policyTier,
    });

    console.error(`[Agent] Run ${run.id} failed for tenant ${tenantId}:`, errorMsg);
    return run.id;
  }
}

export async function runAgentForAllTenants(): Promise<void> {
  const tenants = await db.select({ id: tenantsTable.id, settings: tenantsTable.settings }).from(tenantsTable);

  for (const tenant of tenants) {
    const config = getTenantAgentConfig(tenant.settings);
    if (config.agentEnabled === false) {
      console.log(`[Agent] Skipping tenant ${tenant.id} (agent disabled)`);
      continue;
    }

    const policyTier = config.agentPolicyTier || "observe";
    try {
      await runAgentCycle(tenant.id, policyTier);
    } catch (err) {
      console.error(`[Agent] Error running for tenant ${tenant.id}:`, err instanceof Error ? err.message : err);
    }
  }
}
