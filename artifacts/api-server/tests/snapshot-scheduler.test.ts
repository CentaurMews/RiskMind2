import { describe, it, expect } from "vitest";
import {
  computeCompositeScore,
  buildCellCounts,
} from "../src/lib/risk-snapshot-scheduler";

// ─── SNAP-01: Empty risk list ─────────────────────────────────────────────────

describe("computeCompositeScore()", () => {
  it("SNAP-01: returns 0 for empty risk list", () => {
    expect(computeCompositeScore([])).toBe(0);
  });

  // ─── SNAP-02: Critical risks weighted 2x ─────────────────────────────────

  it("SNAP-02: weights critical risks (raw >= 15) at 2x", () => {
    const risks = [
      { likelihood: 5, impact: 4 }, // raw=20, normalized=80, weight=2
      { likelihood: 2, impact: 2 }, // raw=4,  normalized=16, weight=1
    ];
    // weightedSum = 80*2 + 16*1 = 176, weightTotal = 3
    // compositeScore = Math.round(176 / 3) = 59
    expect(computeCompositeScore(risks)).toBe(59);
  });
});

// ─── SNAP-03: buildCellCounts determinism ────────────────────────────────────

describe("buildCellCounts()", () => {
  it("SNAP-03: produces deterministic output for same input", () => {
    const risks = [
      { likelihood: 3, impact: 4 },
      { likelihood: 3, impact: 4 },
      { likelihood: 1, impact: 2 },
    ];
    const result = buildCellCounts(risks);
    expect(result).toEqual({ "3-4": 2, "1-2": 1 });
    // Call again — same result (deterministic)
    expect(buildCellCounts(risks)).toEqual(result);
  });
});
