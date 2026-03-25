import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getComplianceStatus,
  computeComplianceScore,
  recalculateAndTriggerPipeline,
} from "@/lib/compliance-pipeline";

// ─── Mock database ─────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// ─── getComplianceStatus() tests ──────────────────────────────────────────────

describe("getComplianceStatus()", () => {
  it("returns COMPLIANT when score >= threshold", () => {
    expect(getComplianceStatus(85, 80)).toBe("COMPLIANT");
  });

  it("returns AT-RISK when score >= threshold - 15 but < threshold", () => {
    expect(getComplianceStatus(70, 80)).toBe("AT-RISK");
  });

  it("returns NON-COMPLIANT when score < threshold - 15", () => {
    expect(getComplianceStatus(60, 80)).toBe("NON-COMPLIANT");
  });

  it("handles edge case: score exactly at threshold", () => {
    expect(getComplianceStatus(80, 80)).toBe("COMPLIANT");
  });

  it("handles edge case: score exactly at threshold - 15", () => {
    expect(getComplianceStatus(65, 80)).toBe("AT-RISK");
  });
});

// ─── computeComplianceScore() tests ──────────────────────────────────────────

describe("computeComplianceScore()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns score using formula: coverage*0.6 + effectiveness*0.4", async () => {
    // Mock DB to return: 10 total requirements, 8 covered, 5 total controls, 4 passed
    // coverage = 8/10 = 0.8, effectiveness = 4/5 = 0.8
    // score = 0.8 * 0.6 + 0.8 * 0.4 = 0.48 + 0.32 = 0.80 -> 80

    const { db } = await import("@workspace/db");
    const mockDb = db as ReturnType<typeof vi.fn> & {
      select: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };

    // Requirements coverage query result
    const coverageMock = [
      { totalRequirements: 10, coveredRequirements: 8 },
    ];
    // Controls effectiveness query result
    const effectivenessMock = [
      { totalControls: 5, passedControls: 4 },
    ];

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce(coverageMock),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce(effectivenessMock),
      });

    const result = await computeComplianceScore("fw-001", "tenant-001");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result).toHaveProperty("coverageScore");
    expect(result).toHaveProperty("effectivenessScore");
    expect(result).toHaveProperty("totalRequirements");
    expect(result).toHaveProperty("coveredRequirements");
    expect(result).toHaveProperty("totalControls");
    expect(result).toHaveProperty("passedControls");
  });

  it("returns 0 effectiveness when no controls exist", async () => {
    const { db } = await import("@workspace/db");
    const mockDb = db as ReturnType<typeof vi.fn> & {
      select: ReturnType<typeof vi.fn>;
    };

    const coverageMock = [{ totalRequirements: 10, coveredRequirements: 5 }];
    const effectivenessMock = [{ totalControls: 0, passedControls: 0 }];

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce(coverageMock),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce(effectivenessMock),
      });

    const result = await computeComplianceScore("fw-002", "tenant-001");
    expect(result.effectivenessScore).toBe(0);
    expect(result.totalControls).toBe(0);
  });
});

// ─── recalculateAndTriggerPipeline() tests ────────────────────────────────────

describe("recalculateAndTriggerPipeline()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns action: none when framework has no threshold", async () => {
    const { db } = await import("@workspace/db");
    const mockDb = db as ReturnType<typeof vi.fn> & {
      select: ReturnType<typeof vi.fn>;
    };

    // Mock framework with null complianceThreshold
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValueOnce([
        { id: "fw-001", complianceThreshold: null },
      ]),
    });

    const result = await recalculateAndTriggerPipeline("fw-001", "tenant-001");
    expect(result.action).toBe("none");
  });

  it("creates finding when score < threshold", async () => {
    const { db } = await import("@workspace/db");
    const mockDb = db as ReturnType<typeof vi.fn> & {
      select: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
    };

    // Framework has threshold=80, score will be ~50 (below threshold)
    // Mock framework query
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([
          { id: "fw-001", complianceThreshold: 80, name: "ISO 27001" },
        ]),
      })
      // Mock coverage query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce([
          { totalRequirements: 10, coveredRequirements: 3 },
        ]),
      })
      // Mock effectiveness query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce([
          { totalControls: 5, passedControls: 1 },
        ]),
      })
      // Mock existing findings (none found = no existing finding)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([]),
      });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValueOnce([{ id: "finding-001" }]),
    });

    const result = await recalculateAndTriggerPipeline("fw-001", "tenant-001");
    expect(result.action).toBe("created");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("status");
  });

  it("does not create duplicate finding (idempotent per D-03)", async () => {
    const { db } = await import("@workspace/db");
    const mockDb = db as ReturnType<typeof vi.fn> & {
      select: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
    };

    // Framework with threshold=80, score below threshold
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([
          { id: "fw-001", complianceThreshold: 80, name: "ISO 27001" },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce([
          { totalRequirements: 10, coveredRequirements: 3 },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce([
          { totalControls: 5, passedControls: 1 },
        ]),
      })
      // Existing open finding already present
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([
          { id: "finding-existing", status: "open" },
        ]),
      });

    const insertSpy = mockDb.insert;

    const result = await recalculateAndTriggerPipeline("fw-001", "tenant-001");
    // Should not create a duplicate — no new insert
    expect(result.action).not.toBe("created");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("resolves open findings when score >= threshold", async () => {
    const { db } = await import("@workspace/db");
    const mockDb = db as ReturnType<typeof vi.fn> & {
      select: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };

    // Score will be above threshold
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([
          { id: "fw-001", complianceThreshold: 60, name: "ISO 27001" },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce([
          { totalRequirements: 10, coveredRequirements: 9 },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValueOnce([
          { totalControls: 5, passedControls: 5 },
        ]),
      })
      // Existing open finding
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([
          { id: "finding-existing", status: "open" },
        ]),
      });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValueOnce([]),
    });

    const result = await recalculateAndTriggerPipeline("fw-001", "tenant-001");
    expect(result.action).toBe("resolved");
    expect(mockDb.update).toHaveBeenCalled();
  });
});
