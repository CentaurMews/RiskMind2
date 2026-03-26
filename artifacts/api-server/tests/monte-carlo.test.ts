import { describe, it, expect } from "vitest";
import {
  runSimulation,
  sampleTriangular,
  buildExceedanceCurve,
  computeCalibration,
  type FAIRParams,
} from "../src/lib/monte-carlo";

const FAIR_PARAMS: FAIRParams = {
  tef: { min: 1, mode: 5, max: 10 },
  vulnerability: { min: 0.1, mode: 0.3, max: 0.5 },
  lossMagnitude: { min: 10_000, mode: 50_000, max: 100_000 },
};

// ─── Test 1: runSimulation basic outputs ──────────────────────────────────────

describe("runSimulation()", () => {
  it("returns ale > 0 for standard FAIR params", () => {
    const result = runSimulation(FAIR_PARAMS, 10_000);
    expect(result.ale).toBeGreaterThan(0);
  });

  it("returns iterations = requested count", () => {
    const result = runSimulation(FAIR_PARAMS, 10_000);
    expect(result.iterations).toBe(10_000);
  });

  it("returns durationMs > 0", () => {
    const result = runSimulation(FAIR_PARAMS, 10_000);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("returns histogram with 30 bins whose counts sum to iterations", () => {
    const result = runSimulation(FAIR_PARAMS, 10_000);
    expect(result.histogram).toHaveLength(30);
    const total = result.histogram.reduce((sum, bin) => sum + bin.count, 0);
    expect(total).toBe(10_000);
  });

  it("returns percentiles object with expected keys", () => {
    const result = runSimulation(FAIR_PARAMS, 10_000);
    const keys = ["p5", "p10", "p25", "p50", "p75", "p90", "p95", "p99"];
    for (const k of keys) {
      expect(result.percentiles).toHaveProperty(k);
      expect(typeof result.percentiles[k]).toBe("number");
    }
  });

  // ─── Test 4: monotonically non-decreasing percentiles ─────────────────────

  it("percentiles are monotonically non-decreasing", () => {
    const result = runSimulation(FAIR_PARAMS, 10_000);
    const { p5, p10, p25, p50, p75, p90, p95, p99 } = result.percentiles;
    expect(p5).toBeLessThanOrEqual(p10);
    expect(p10).toBeLessThanOrEqual(p25);
    expect(p25).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p75);
    expect(p75).toBeLessThanOrEqual(p90);
    expect(p90).toBeLessThanOrEqual(p95);
    expect(p95).toBeLessThanOrEqual(p99);
  });

  it("rejects iteration counts > 500_000", () => {
    expect(() => runSimulation(FAIR_PARAMS, 500_001)).toThrow();
  });
});

// ─── Test 2: sampleTriangular degenerate case ─────────────────────────────────

describe("sampleTriangular()", () => {
  it("returns min value when min === mode === max without NaN", () => {
    const result = sampleTriangular(5, 5, 5);
    expect(result).toBe(5);
    expect(Number.isNaN(result)).toBe(false);
  });

  it("returns value within [min, max] range", () => {
    for (let i = 0; i < 100; i++) {
      const result = sampleTriangular(1, 5, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    }
  });

  it("returns min value when min === max (degenerate)", () => {
    const result = sampleTriangular(3, 3, 3);
    expect(result).toBe(3);
  });
});

// ─── Test 3: histogram bins are contiguous ────────────────────────────────────

describe("histogram contiguity", () => {
  it("bins are contiguous (bin[i].max === bin[i+1].min)", () => {
    const result = runSimulation(FAIR_PARAMS, 1_000);
    for (let i = 0; i < result.histogram.length - 1; i++) {
      expect(result.histogram[i].max).toBeCloseTo(result.histogram[i + 1].min, 10);
    }
  });
});

// ─── Test 5: buildExceedanceCurve ─────────────────────────────────────────────

describe("buildExceedanceCurve()", () => {
  it("returns monotonically non-increasing y-values", () => {
    const result = runSimulation(FAIR_PARAMS, 1_000);
    const curve = buildExceedanceCurve(result.histogram, result.iterations);
    expect(curve.length).toBeGreaterThan(0);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i][1]).toBeLessThanOrEqual(curve[i - 1][1]);
    }
  });

  it("starts at probability 1.0 and ends at 0.0", () => {
    const result = runSimulation(FAIR_PARAMS, 1_000);
    const curve = buildExceedanceCurve(result.histogram, result.iterations);
    expect(curve[0][1]).toBeCloseTo(1.0, 5);
    expect(curve[curve.length - 1][1]).toBeCloseTo(0.0, 5);
  });
});

// ─── Test 6: computeCalibration with empty array ──────────────────────────────

describe("computeCalibration()", () => {
  it("returns null parameters (not NaN) when signal array is empty", () => {
    const result = computeCalibration([]);
    expect(result.tef).toBeNull();
    expect(result.vulnerability).toBeNull();
    expect(result.lossMagnitude).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  // ─── Test 7: calibration with CVSS scores ─────────────────────────────────

  it("produces lossMagnitude range proportional to CVSS score", () => {
    // High CVSS (9.5) should produce higher lossMagnitude than low CVSS (2.0)
    const highCvssSignals = [
      { source: "nvd", metadata: { cvssScore: 9.5 }, createdAt: new Date() },
      { source: "nvd", metadata: { cvssScore: 9.0 }, createdAt: new Date() },
    ];
    const lowCvssSignals = [
      { source: "nvd", metadata: { cvssScore: 2.0 }, createdAt: new Date() },
      { source: "nvd", metadata: { cvssScore: 1.5 }, createdAt: new Date() },
    ];
    const highResult = computeCalibration(highCvssSignals);
    const lowResult = computeCalibration(lowCvssSignals);

    expect(highResult.lossMagnitude).not.toBeNull();
    expect(lowResult.lossMagnitude).not.toBeNull();
    expect(highResult.lossMagnitude!.mode).toBeGreaterThan(lowResult.lossMagnitude!.mode);
  });

  it("returns sampleSize equal to number of signals provided", () => {
    const signals = [
      { source: "nvd", metadata: { cvssScore: 5.0 }, createdAt: new Date() },
      { source: "nvd", metadata: { cvssScore: 6.0 }, createdAt: new Date() },
      { source: "misp", metadata: { threatLevel: "high" }, createdAt: new Date() },
    ];
    const result = computeCalibration(signals);
    expect(result.sampleSize).toBe(3);
  });

  it("produces vulnerability estimate from MISP threat levels", () => {
    const signals = [
      { source: "misp", metadata: { threatLevel: "high" }, createdAt: new Date() },
      { source: "misp", metadata: { threatLevel: "medium" }, createdAt: new Date() },
    ];
    const result = computeCalibration(signals);
    expect(result.vulnerability).not.toBeNull();
    expect(result.vulnerability!.min).toBeGreaterThanOrEqual(0);
    expect(result.vulnerability!.max).toBeLessThanOrEqual(1);
  });
});
