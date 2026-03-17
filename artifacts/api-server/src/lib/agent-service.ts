import { eq, and, sql, desc, gt, lt, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  signalsTable,
  alertsTable,
  agentRunsTable,
  agentFindingsTable,
} from "@workspace/db";
import { complete, isAvailable } from "./llm-service";
import { recordAuditDirect } from "./audit";
import { invokeTool } from "./tool-registry";
import { RiskSourceAggregator } from "../services/risk-source-aggregator";

async function agentAudit(
  tenantId: string,
  agentRunId: string,
  action: string,
  entityType: string,
  entityId: string | undefined,
  payload?: Record<string, unknown>,
) {
  await recordAuditDirect(tenantId, null, action, entityType, entityId, {
    ...payload,
    actor: "agent",
    agentRunId,
  });
}

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

  const [risksResult, krisResult, vendorsResult, signalsResult, alertsResult, controlsResult, frameworksResult] = await Promise.all([
    invokeTool("list_risks", { tenantId }),
    invokeTool("list_kris", { tenantId }),
    invokeTool("list_vendors", { tenantId }),
    invokeTool("list_signals", { tenantId, since: thirtyDaysAgo }),
    invokeTool("list_alerts", { tenantId }),
    invokeTool("list_controls", { tenantId }),
    invokeTool("list_frameworks", { tenantId }),
  ]);

  const risks = risksResult.data;
  const kris = krisResult.data;
  const vendors = vendorsResult.data;
  const signals = signalsResult.data;
  const alerts = alertsResult.data;
  const controls = controlsResult.data;
  const frameworks = frameworksResult.data;

  const unmappedRequirements = frameworks.length > 0
    ? (await invokeTool("run_gap_analysis", { tenantId })).data
    : [];

  const failedControlTests = controls.length > 0
    ? (await invokeTool("list_failed_control_tests", { tenantId, since: thirtyDaysAgo })).data
    : [];

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

  const gapsByFramework = new Map<string, Array<Record<string, unknown>>>();
  for (const req of data.unmappedRequirements) {
    const fwId = req.frameworkId as string;
    if (!gapsByFramework.has(fwId)) gapsByFramework.set(fwId, []);
    gapsByFramework.get(fwId)!.push(req);
  }

  const vendorsByCategory = new Map<string, Array<Record<string, unknown>>>();
  for (const v of data.vendors) {
    const cat = (v.category as string) || "uncategorized";
    if (!vendorsByCategory.has(cat)) vendorsByCategory.set(cat, []);
    vendorsByCategory.get(cat)!.push(v);
  }

  const risksByCategory = new Map<string, Array<Record<string, unknown>>>();
  for (const r of data.risks) {
    const cat = r.category as string;
    if (!risksByCategory.has(cat)) risksByCategory.set(cat, []);
    risksByCategory.get(cat)!.push(r);
  }

  for (const risk of data.risks) {
    const riskId = risk.id as string;
    const riskCategory = risk.category as string;
    const chain: LinkedEntity[] = [];
    const chainSegments: string[] = [];

    chain.push({ type: "risk", id: riskId, label: risk.title as string });

    const riskKris = krisByRisk.get(riskId) || [];
    const breachedKris = riskKris.filter(k => {
      const val = Number(k.currentValue);
      const crit = Number(k.criticalThreshold);
      return val >= crit;
    });

    if (breachedKris.length > 0) {
      for (const k of breachedKris) {
        chain.push({ type: "kri", id: k.id as string, label: k.name as string });
      }
      chainSegments.push(`${breachedKris.length} breached KRI(s)`);
    }

    const riskAlerts = data.alerts.filter(a => {
      const ctx = a.context as Record<string, unknown> | null;
      return ctx && ctx.riskId === riskId;
    });
    if (riskAlerts.length > 0) {
      for (const a of riskAlerts) {
        chain.push({ type: "alert", id: a.id as string, label: a.title as string });
      }
      chainSegments.push(`${riskAlerts.length} active alert(s)`);
    }

    const relatedVendors = vendorsByCategory.get(riskCategory) || [];
    const highRiskVendors = relatedVendors.filter(v => {
      const score = Number(v.riskScore || 0);
      return score >= 7;
    });
    if (highRiskVendors.length > 0) {
      for (const v of highRiskVendors) {
        chain.push({ type: "vendor", id: v.id as string, label: v.name as string });
      }
      chainSegments.push(`${highRiskVendors.length} high-risk vendor(s) in category "${riskCategory}"`);
    }

    const controlsWithFailures = [...failedByControl.keys()];
    if (controlsWithFailures.length > 0 && breachedKris.length > 0) {
      for (const cid of controlsWithFailures) {
        const ctrl = data.controls.find(c => c.id === cid);
        if (ctrl) {
          chain.push({ type: "control", id: cid, label: ctrl.title as string });
        }
      }
      chainSegments.push(`${controlsWithFailures.length} control(s) with test failures`);
    }

    if (chainSegments.length < 2) continue;

    const severity = chainSegments.length >= 4 ? "critical" :
                     chainSegments.length >= 3 ? "high" : "medium";

    const chainPath = chainSegments.join(" → ");
    findings.push({
      type: "cascade_chain",
      severity,
      title: `Multi-hop cascade: ${risk.title} — ${chain.length} linked entities across ${chainSegments.length} domains`,
      narrative: `Risk "${risk.title}" participates in a cross-domain cascade chain: ${chainPath}. This ${chain.length}-node graph spans multiple entity types indicating systemic exposure that requires coordinated remediation.`,
      linkedEntities: chain,
      proposedAction: {
        type: "create_review_flag",
        title: `Review cascade: ${risk.title}`,
        severity,
        context: {
          riskId,
          chainDepth: chainSegments.length,
          entityCount: chain.length,
          domains: chainSegments,
        },
      },
    });
  }

  for (const [fwId, gaps] of gapsByFramework) {
    const framework = data.frameworks.find(f => f.id === fwId);
    if (!framework) continue;
    if (gaps.length < 3) continue;

    const chain: LinkedEntity[] = [
      { type: "framework", id: fwId, label: framework.name as string },
    ];
    const chainSegments: string[] = [`${gaps.length} unmapped requirements`];

    const topGaps = gaps.slice(0, 5);
    for (const g of topGaps) {
      chain.push({ type: "framework_requirement", id: g.id as string, label: `${g.code}: ${g.title}` });
    }

    if (failedByControl.size > 0) {
      for (const [cid] of failedByControl) {
        const ctrl = data.controls.find(c => c.id === cid);
        if (ctrl) {
          chain.push({ type: "control", id: cid, label: ctrl.title as string });
        }
      }
      chainSegments.push(`${failedByControl.size} control(s) with test failures`);
    }

    const relatedRisks = (risksByCategory.get("compliance") || [])
      .filter(r => r.status === "open" || r.status === "mitigating");
    if (relatedRisks.length > 0) {
      for (const r of relatedRisks.slice(0, 3)) {
        chain.push({ type: "risk", id: r.id as string, label: r.title as string });
      }
      chainSegments.push(`${relatedRisks.length} open compliance risk(s)`);
    }

    const severity = gaps.length >= 10 || chainSegments.length >= 3 ? "high" : "medium";

    findings.push({
      type: "cascade_chain",
      severity,
      title: `Compliance cascade: ${framework.name} — ${chain.length} linked entities across ${chainSegments.length} domains`,
      narrative: `Framework "${framework.name}" has ${gaps.length} requirement(s) with no mapped control. ${failedByControl.size > 0 ? `Additionally, ${failedByControl.size} existing control(s) have recent test failures, indicating weakened coverage. ` : ""}${relatedRisks.length > 0 ? `${relatedRisks.length} open compliance risks amplify this exposure. ` : ""}This creates a systemic compliance gap spanning ${chainSegments.length} domains.`,
      linkedEntities: chain,
      proposedAction: {
        type: "create_signal",
        content: `Compliance cascade: ${framework.name} — ${gaps.length} unmapped requirements across ${chainSegments.length} domains`,
        classification: "compliance_gap",
      },
    });
  }

  for (const [cat, vendors] of vendorsByCategory) {
    const highRiskVendors = vendors.filter(v => Number(v.riskScore || 0) >= 7);
    if (highRiskVendors.length < 2) continue;

    const chain: LinkedEntity[] = [];
    const chainSegments: string[] = [`${highRiskVendors.length} high-risk vendors in "${cat}"`];

    for (const v of highRiskVendors) {
      chain.push({ type: "vendor", id: v.id as string, label: v.name as string });
    }

    const catRisks = risksByCategory.get(cat) || [];
    const openCatRisks = catRisks.filter(r => r.status === "open" || r.status === "mitigating");
    if (openCatRisks.length > 0) {
      for (const r of openCatRisks.slice(0, 3)) {
        chain.push({ type: "risk", id: r.id as string, label: r.title as string });
      }
      chainSegments.push(`${openCatRisks.length} open risk(s) in category`);
    }

    const vendorAlerts = data.alerts.filter(a => {
      const ctx = a.context as Record<string, unknown> | null;
      return ctx && highRiskVendors.some(v => v.id === ctx.vendorId);
    });
    if (vendorAlerts.length > 0) {
      for (const a of vendorAlerts) {
        chain.push({ type: "alert", id: a.id as string, label: a.title as string });
      }
      chainSegments.push(`${vendorAlerts.length} vendor alert(s)`);
    }

    if (chainSegments.length < 2) continue;

    findings.push({
      type: "cascade_chain",
      severity: highRiskVendors.length >= 3 ? "high" : "medium",
      title: `Vendor concentration cascade: ${cat} — ${chain.length} linked entities`,
      narrative: `${highRiskVendors.length} high-risk vendors in category "${cat}" create concentration risk. ${openCatRisks.length > 0 ? `${openCatRisks.length} open risk(s) in the same category amplify this exposure. ` : ""}${vendorAlerts.length > 0 ? `${vendorAlerts.length} active vendor alert(s) indicate ongoing issues. ` : ""}This multi-hop chain spans ${chainSegments.length} domains.`,
      linkedEntities: chain,
      proposedAction: {
        type: "create_review_flag",
        title: `Review vendor concentration: ${cat}`,
        severity: highRiskVendors.length >= 3 ? "high" : "medium",
        context: { category: cat, vendorCount: highRiskVendors.length, chainDepth: chainSegments.length },
      },
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
        SELECT id, content AS label, classification AS source_type, 'signal' AS entity_type, embedding
        FROM signals
        WHERE tenant_id = ${tenantId} AND embedding IS NOT NULL
          AND created_at > now() - interval '30 days'
      ),
      vendor_embeddings AS (
        SELECT id, name AS label, category AS source_type, 'vendor' AS entity_type, embedding
        FROM vendors
        WHERE tenant_id = ${tenantId} AND embedding IS NOT NULL
      ),
      all_sources AS (
        SELECT * FROM signal_embeddings
        UNION ALL
        SELECT * FROM vendor_embeddings
      ),
      similarities AS (
        SELECT
          r.id AS risk_id, r.title AS risk_title, r.category,
          s.id AS source_id, s.label AS source_label, s.source_type, s.entity_type,
          1 - (r.embedding <=> s.embedding) AS similarity
        FROM risk_embeddings r
        CROSS JOIN all_sources s
        WHERE 1 - (r.embedding <=> s.embedding) > 0.75
      )
      SELECT risk_id, risk_title, category,
        json_agg(json_build_object(
          'sourceId', source_id,
          'label', LEFT(source_label, 200),
          'sourceType', source_type,
          'entityType', entity_type,
          'similarity', ROUND(similarity::numeric, 3)
        ) ORDER BY similarity DESC) AS related_sources,
        COUNT(*) AS source_count
      FROM similarities
      GROUP BY risk_id, risk_title, category
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);

    for (const row of clusters.rows as Array<Record<string, unknown>>) {
      const sources = row.related_sources as Array<Record<string, unknown>>;
      const entities: LinkedEntity[] = [
        { type: "risk", id: row.risk_id as string, label: row.risk_title as string },
        ...sources.slice(0, 5).map(s => ({
          type: String(s.entityType) as string,
          id: s.sourceId as string,
          label: (s.label as string).substring(0, 80),
        })),
      ];

      const hasVendors = sources.some(s => s.entityType === "vendor");
      const clusterLabel = hasVendors ? "risks, signals, and vendor issues" : "risks and signals";

      findings.push({
        type: "cluster",
        severity: (sources.length >= 5 ? "high" : "medium") as Finding["severity"],
        title: `Threat cluster: ${row.risk_title} — ${row.source_count} correlated sources`,
        narrative: `Risk "${row.risk_title}" (${row.category}) has ${row.source_count} semantically correlated source(s) across ${clusterLabel} detected in the past 30 days. These form a coherent threat cluster that may indicate an emerging risk pattern.`,
        linkedEntities: entities,
        proposedAction: {
          type: "create_alert",
          title: `Threat cluster detected: ${row.risk_title}`,
          severity: sources.length >= 5 ? "high" : "medium",
          context: { riskId: row.risk_id, sourceCount: row.source_count },
        },
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
      }
    }

    if (trendingKris.length >= 3) {
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
    let findingStatus: "pending_review" | "acknowledged" | "dismissed" | "actioned";
    let storedAction: Record<string, unknown> | null = null;

    if (policyTier === "observe") {
      findingStatus = "acknowledged";
      storedAction = null;
    } else if (policyTier === "advisory") {
      findingStatus = "pending_review";
      storedAction = finding.proposedAction || null;
    } else {
      storedAction = finding.proposedAction || null;
      const actionType = storedAction ? String(storedAction.type || "") : "";
      const isAutoExecutable = actionType === "create_alert" || actionType === "create_review_flag";
      findingStatus = isAutoExecutable ? "actioned" : "pending_review";
    }

    const [saved] = await db.insert(agentFindingsTable).values({
      tenantId,
      runId,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      narrative: finding.narrative,
      linkedEntities: finding.linkedEntities,
      proposedAction: storedAction,
      status: findingStatus,
      actionedAt: findingStatus === "actioned" ? new Date() : null,
    }).returning();

    await agentAudit(tenantId, runId, "agent_finding_created", "agent_finding", saved.id, {
      type: finding.type,
      severity: finding.severity,
      policyTier,
      findingStatus,
    });

    if (policyTier === "active" && storedAction) {
      try {
        const actionType = String(storedAction.type || "");

        if (actionType === "create_alert" || actionType === "create_review_flag") {
          const alertType = actionType === "create_review_flag" ? "review_flag" : "agent_insight";
          const [existing] = await db.select({ id: alertsTable.id }).from(alertsTable)
            .where(and(
              eq(alertsTable.tenantId, tenantId),
              eq(alertsTable.type, alertType),
              eq(alertsTable.title, String(storedAction.title || finding.title)),
              eq(alertsTable.status, "active"),
            )).limit(1);

          if (!existing) {
            const [alert] = await db.insert(alertsTable).values({
              tenantId,
              type: alertType,
              title: String(storedAction.title || finding.title),
              description: finding.narrative,
              severity: (["critical", "high", "medium", "low"].includes(String(storedAction.severity)) ? String(storedAction.severity) : "medium") as "critical" | "high" | "medium" | "low",
              context: { agentRunId: runId, findingId: saved.id, linkedEntities: finding.linkedEntities },
            }).returning();

            await agentAudit(tenantId, runId, "agent_auto_" + alertType, "alert", alert.id, {
              findingId: saved.id,
              severity: finding.severity,
            });
          }
        }

      } catch (err) {
        console.error("[Agent] Failed to execute active-mode action:", err instanceof Error ? err.message : err);

        await db.update(agentFindingsTable).set({
          status: "pending_review",
          actionedAt: null,
          updatedAt: new Date(),
        }).where(eq(agentFindingsTable.id, saved.id));
      }
    }

    savedCount++;
  }

  return savedCount;
}

export async function runAgentCycle(
  tenantId: string,
  policyTier: "observe" | "advisory" | "active" = "observe",
  scheduleInfo?: { schedule?: string; triggeredBy?: "scheduler" | "manual" },
): Promise<string> {
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

    const aggregator = new RiskSourceAggregator(tenantId);
    let aggregatedSources: Awaited<ReturnType<RiskSourceAggregator["aggregateRiskSources"]>> | null = null;
    try {
      aggregatedSources = await aggregator.aggregateRiskSources();
      if (aggregatedSources.findings.length > 0 || aggregatedSources.agentDetections.length > 0) {
        console.log(`[Agent] Aggregated sources for ${tenantId}: ${aggregatedSources.signals.length} signals, ${aggregatedSources.findings.length} unlinked findings, ${aggregatedSources.agentDetections.length} agent detections`);
      }
    } catch (aggErr) {
      console.warn("[Agent] Risk source aggregation failed:", aggErr);
    }

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
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[Agent] LLM reasoning failed, skipping run:", errMsg);

        const durationMs = Date.now() - startTime;
        await db.update(agentRunsTable).set({
          status: "skipped",
          durationMs,
          findingCount: 0,
          completedAt: new Date(),
          context: {
            reason: `LLM provider unreachable: ${errMsg}`,
            llmAvailable: false,
            localFindingsDetected: localFindings.length,
            schedule: scheduleInfo?.schedule || null,
            triggeredBy: scheduleInfo?.triggeredBy || "manual",
            observationSummary: {
              risks: data.risks.length,
              kris: data.kris.length,
              vendors: data.vendors.length,
              signals: data.signals.length,
              alerts: data.alerts.length,
              controls: data.controls.length,
              unmappedRequirements: data.unmappedRequirements.length,
            },
          },
        }).where(eq(agentRunsTable.id, run.id));

        await agentAudit(tenantId, run.id, "agent_run_skipped", "agent_run", run.id, {
          policyTier,
          reason: `LLM provider unreachable: ${errMsg}`,
          localFindingsDetected: localFindings.length,
          triggeredBy: scheduleInfo?.triggeredBy || "manual",
        });

        return run.id;
      }
    } else {
      const durationMs = Date.now() - startTime;
      const skipReason = "LLM provider unavailable or not configured";
      console.log(`[Agent] LLM not available for tenant ${tenantId}, skipping run`);

      await db.update(agentRunsTable).set({
        status: "skipped",
        durationMs,
        findingCount: 0,
        completedAt: new Date(),
        context: {
          reason: skipReason,
          llmAvailable: false,
          localFindingsDetected: localFindings.length,
          schedule: scheduleInfo?.schedule || null,
          triggeredBy: scheduleInfo?.triggeredBy || "manual",
          observationSummary: {
            risks: data.risks.length,
            kris: data.kris.length,
            vendors: data.vendors.length,
            signals: data.signals.length,
            alerts: data.alerts.length,
            controls: data.controls.length,
            unmappedRequirements: data.unmappedRequirements.length,
          },
        },
      }).where(eq(agentRunsTable.id, run.id));

      await agentAudit(tenantId, run.id, "agent_run_skipped", "agent_run", run.id, {
        policyTier,
        reason: skipReason,
        localFindingsDetected: localFindings.length,
        triggeredBy: scheduleInfo?.triggeredBy || "manual",
      });

      console.log(`[Agent] Run ${run.id} skipped for tenant ${tenantId}: ${skipReason}`);
      return run.id;
    }

    const allFindings = [...localFindings, ...llmFindings];

    const savedCount = await act(tenantId, run.id, allFindings, policyTier);

    const durationMs = Date.now() - startTime;
    const promptTokens = Math.floor(tokenEstimate * 0.8);
    const completionTokens = Math.floor(tokenEstimate * 0.2);
    const costPerInputToken = 0.000003;
    const costPerOutputToken = 0.000015;
    const estimatedCost = (promptTokens * costPerInputToken + completionTokens * costPerOutputToken).toFixed(6);

    await db.update(agentRunsTable).set({
      status: "completed",
      model,
      tokenCount: tokenEstimate,
      promptTokens,
      completionTokens,
      estimatedCost,
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
        schedule: scheduleInfo?.schedule || null,
        triggeredBy: scheduleInfo?.triggeredBy || "manual",
      },
    }).where(eq(agentRunsTable.id, run.id));

    await agentAudit(tenantId, run.id, "agent_run_completed", "agent_run", run.id, {
      policyTier,
      findingCount: savedCount,
      durationMs,
      llmAvailable: available,
      triggeredBy: scheduleInfo?.triggeredBy || "manual",
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

    await agentAudit(tenantId, run.id, "agent_run_failed", "agent_run", run.id, {
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
