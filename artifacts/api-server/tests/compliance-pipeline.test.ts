import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Mock setup — vi.mock hoists, so we use vi.hoisted() for shared mocks
// ──────────────────────────────────────────────────────────────────────────────

const { mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => {
  return {
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
  frameworksTable: {
    id: "id",
    tenantId: "tenant_id",
    name: "name",
    complianceThreshold: "compliance_threshold",
  },
  frameworkRequirementsTable: {
    id: "id",
    frameworkId: "framework_id",
    tenantId: "tenant_id",
  },
  controlRequirementMapsTable: {
    requirementId: "requirement_id",
    controlId: "control_id",
    tenantId: "tenant_id",
  },
  controlsTable: { id: "id", tenantId: "tenant_id" },
  controlTestsTable: {
    controlId: "control_id",
    result: "result",
    tenantId: "tenant_id",
    testedAt: "tested_at",
  },
  findingsTable: {
    id: "id",
    tenantId: "tenant_id",
    title: "title",
    status: "finding_status",
  },
  alertsTable: {
    id: "id",
    tenantId: "tenant_id",
    type: "type",
    title: "title",
    status: "alert_status",
  },
  risksTable: {
    id: "id",
    tenantId: "tenant_id",
    title: "title",
    category: "category",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  inArray: (col: unknown, vals: unknown) => ({ type: "inArray", col, vals }),
}));

import {
  computeComplianceScore,
  getComplianceStatus,
  recalculateAndTriggerPipeline,
} from "../src/lib/compliance-pipeline";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Create a chainable DB query mock that resolves to `value` */
function chain(value: unknown) {
  const proxy: Record<string, unknown> = {};
  const methods = ["from", "where", "limit", "orderBy"];
  for (const m of methods) {
    proxy[m] = () => proxy;
  }
  proxy[Symbol.iterator as unknown as string] = function* () {
    yield* (value as unknown[]);
  };
  // make awaitable
  proxy.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(value).then(resolve, reject);
  return proxy;
}

function insertChain(value: unknown) {
  const proxy: Record<string, unknown> = {};
  proxy.values = () => {
    const inner: Record<string, unknown> = {};
    inner.returning = () => Promise.resolve(value);
    inner.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject);
    return inner;
  };
  return proxy;
}

function updateChain() {
  const proxy: Record<string, unknown> = {};
  proxy.set = () => {
    const inner: Record<string, unknown> = {};
    inner.where = () => Promise.resolve();
    inner.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve().then(resolve, reject);
    return inner;
  };
  return proxy;
}

// ──────────────────────────────────────────────────────────────────────────────
// getComplianceStatus
// ──────────────────────────────────────────────────────────────────────────────

describe("getComplianceStatus", () => {
  it("returns COMPLIANT when score >= threshold", () => {
    expect(getComplianceStatus(80, 80)).toBe("COMPLIANT");
    expect(getComplianceStatus(90, 80)).toBe("COMPLIANT");
    expect(getComplianceStatus(100, 80)).toBe("COMPLIANT");
  });

  it("returns AT-RISK when score >= threshold - 15 (within 15%)", () => {
    expect(getComplianceStatus(65, 80)).toBe("AT-RISK");
    expect(getComplianceStatus(70, 80)).toBe("AT-RISK");
    expect(getComplianceStatus(79, 80)).toBe("AT-RISK");
  });

  it("returns NON-COMPLIANT when score < threshold - 15", () => {
    expect(getComplianceStatus(64, 80)).toBe("NON-COMPLIANT");
    expect(getComplianceStatus(0, 80)).toBe("NON-COMPLIANT");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// computeComplianceScore
// ──────────────────────────────────────────────────────────────────────────────

describe("computeComplianceScore", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns all sub-scores using coverageScore*0.6 + effectivenessScore*0.4", async () => {
    // 2 requirements, 1 covered => coverageScore = 50
    // 1 control, 1 passed => effectivenessScore = 100
    // score = round(50*0.6 + 100*0.4) = round(30+40) = 70
    mockSelect
      .mockReturnValueOnce(chain([{ id: "req-1" }, { id: "req-2" }]))
      .mockReturnValueOnce(chain([{ requirementId: "req-1", controlId: "ctrl-1" }]))
      .mockReturnValueOnce(chain([{ controlId: "ctrl-1", result: "pass" }]));

    const result = await computeComplianceScore("fw-1", "tenant-1");
    expect(result.totalRequirements).toBe(2);
    expect(result.coveredRequirements).toBe(1);
    expect(result.coverageScore).toBe(50);
    expect(result.effectivenessScore).toBe(100);
    expect(result.score).toBe(70);
    expect(result.totalControls).toBe(1);
    expect(result.passedControls).toBe(1);
  });

  it("returns score 0 when no requirements exist", async () => {
    mockSelect.mockReturnValueOnce(chain([]));
    const result = await computeComplianceScore("fw-1", "tenant-1");
    expect(result.score).toBe(0);
    expect(result.totalRequirements).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// recalculateAndTriggerPipeline
// ──────────────────────────────────────────────────────────────────────────────

describe("recalculateAndTriggerPipeline", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns early with action none when framework has no complianceThreshold", async () => {
    // score 100% (1 req, 1 covered, 1 pass)
    mockSelect
      .mockReturnValueOnce(chain([{ id: "req-1" }]))
      .mockReturnValueOnce(chain([{ requirementId: "req-1", controlId: "ctrl-1" }]))
      .mockReturnValueOnce(chain([{ controlId: "ctrl-1", result: "pass" }]))
      .mockReturnValueOnce(chain([{ id: "fw-1", name: "ISO 27001", complianceThreshold: null }]));

    const result = await recalculateAndTriggerPipeline("fw-1", "tenant-1");
    expect(result.action).toBe("none");
  });

  it("creates finding, alert, and draft risk when score < threshold (breach)", async () => {
    // 2 reqs, 0 covered, 0 controls => score 0 < threshold 80
    mockSelect
      .mockReturnValueOnce(chain([{ id: "req-1" }, { id: "req-2" }]))
      .mockReturnValueOnce(chain([]))           // no mappings
      // no control test query (controlIds empty)
      .mockReturnValueOnce(chain([{ id: "fw-1", name: "ISO 27001", complianceThreshold: "80" }]))
      .mockReturnValueOnce(chain([]))           // no existing finding
      .mockReturnValueOnce(chain([]));          // no existing alert

    mockInsert
      .mockReturnValueOnce(insertChain([{ id: "finding-1" }]))
      .mockReturnValueOnce(insertChain([{ id: "alert-1" }]))
      .mockReturnValueOnce(insertChain([{ id: "risk-1" }]));

    const result = await recalculateAndTriggerPipeline("fw-1", "tenant-1");
    expect(result.action).toBe("created");
    expect(result.score).toBe(0);
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it("is idempotent — does not create new finding when one already exists", async () => {
    // score 0 < threshold 80 but finding already exists
    mockSelect
      .mockReturnValueOnce(chain([{ id: "req-1" }, { id: "req-2" }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: "fw-1", name: "ISO 27001", complianceThreshold: "80" }]))
      .mockReturnValueOnce(chain([{ id: "existing-finding" }])); // finding already exists

    const result = await recalculateAndTriggerPipeline("fw-1", "tenant-1");
    expect(result.action).toBe("created");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("auto-resolves open findings and alerts when score recovers above threshold", async () => {
    // 1 req, 1 covered, 1 pass => score=100 >= threshold=80
    mockSelect
      .mockReturnValueOnce(chain([{ id: "req-1" }]))
      .mockReturnValueOnce(chain([{ requirementId: "req-1", controlId: "ctrl-1" }]))
      .mockReturnValueOnce(chain([{ controlId: "ctrl-1", result: "pass" }]))
      .mockReturnValueOnce(chain([{ id: "fw-1", name: "ISO 27001", complianceThreshold: "80" }]))
      .mockReturnValueOnce(chain([{ id: "finding-open" }]))  // open findings
      .mockReturnValueOnce(chain([{ id: "alert-open" }]));   // open alerts

    mockUpdate
      .mockReturnValueOnce(updateChain())
      .mockReturnValueOnce(updateChain());

    const result = await recalculateAndTriggerPipeline("fw-1", "tenant-1");
    expect(result.action).toBe("resolved");
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("creates alert with type compliance_threshold_breach", async () => {
    mockSelect
      .mockReturnValueOnce(chain([{ id: "req-1" }, { id: "req-2" }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: "fw-1", name: "ISO 27001", complianceThreshold: "80" }]))
      .mockReturnValueOnce(chain([]))  // no existing finding
      .mockReturnValueOnce(chain([])); // no existing active alert

    let capturedAlertValues: Record<string, unknown> | null = null;
    mockInsert.mockImplementation((table: unknown) => {
      // Capture the values call to verify type
      return {
        values: (vals: Record<string, unknown>) => {
          if (vals && vals.type === "compliance_threshold_breach") {
            capturedAlertValues = vals;
          }
          return Promise.resolve([{ id: "inserted-1" }]);
        },
      };
    });

    await recalculateAndTriggerPipeline("fw-1", "tenant-1");
    expect(capturedAlertValues).not.toBeNull();
    expect(capturedAlertValues!.type).toBe("compliance_threshold_breach");
  });

  it("creates draft risk with category compliance when score < threshold", async () => {
    mockSelect
      .mockReturnValueOnce(chain([{ id: "req-1" }, { id: "req-2" }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: "fw-1", name: "ISO 27001", complianceThreshold: "80" }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));

    const insertedValues: Record<string, unknown>[] = [];
    mockInsert.mockImplementation(() => ({
      values: (vals: Record<string, unknown>) => {
        insertedValues.push(vals);
        return Promise.resolve([{ id: "inserted-1" }]);
      },
    }));

    await recalculateAndTriggerPipeline("fw-1", "tenant-1");

    const riskInsert = insertedValues.find(v => v.status === "draft");
    expect(riskInsert).toBeDefined();
    expect(riskInsert!.category).toBe("compliance");
    expect(riskInsert!.status).toBe("draft");
  });
});
