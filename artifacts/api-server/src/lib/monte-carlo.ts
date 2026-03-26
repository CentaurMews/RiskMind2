/**
 * Monte Carlo simulation engine using FAIR (Factor Analysis of Information Risk) model.
 * Pure functions — no side effects, no imports from DB or external services.
 */

const MAX_ITERATIONS = 500_000;
const HISTOGRAM_BINS = 30;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TriangularParam {
  min: number;
  mode: number;
  max: number;
}

export interface FAIRParams {
  tef: TriangularParam;          // Threat Event Frequency (events/year)
  vulnerability: TriangularParam; // Probability [0, 1] that a threat event causes loss
  lossMagnitude: TriangularParam; // Loss per event in $
}

export interface HistogramBin {
  min: number;
  max: number;
  count: number;
}

export interface SimulationResults {
  ale: number;                              // Annual Loss Expectancy ($)
  percentiles: Record<string, number>;      // p5, p10, p25, p50, p75, p90, p95, p99
  histogram: HistogramBin[];                // 30 contiguous bins
  iterations: number;
  durationMs: number;
}

// ─── Core primitives ──────────────────────────────────────────────────────────

/**
 * Sample from a triangular distribution using inverse CDF.
 * Handles degenerate case (min === max) by returning min.
 */
export function sampleTriangular(min: number, mode: number, max: number): number {
  if (min === max) return min;

  const range = max - min;
  const u = Math.random();
  const fc = (mode - min) / range;

  if (u < fc) {
    return min + Math.sqrt(u * range * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * range * (max - mode));
  }
}

// ─── Simulation engine ────────────────────────────────────────────────────────

/**
 * Run Monte Carlo FAIR simulation.
 * @throws Error if iterations > 500,000
 */
export function runSimulation(params: FAIRParams, iterations: number): SimulationResults {
  if (iterations > MAX_ITERATIONS) {
    throw new Error(`Iteration count ${iterations} exceeds maximum of ${MAX_ITERATIONS}`);
  }

  const startMs = Date.now();
  const annualLosses: number[] = new Array(iterations);

  const { tef, vulnerability, lossMagnitude } = params;

  for (let i = 0; i < iterations; i++) {
    const events = sampleTriangular(tef.min, tef.mode, tef.max);
    const vulnProb = sampleTriangular(vulnerability.min, vulnerability.mode, vulnerability.max);
    const loss = sampleTriangular(lossMagnitude.min, lossMagnitude.mode, lossMagnitude.max);

    // Annual loss = expected events * probability loss occurs * loss magnitude
    annualLosses[i] = events * vulnProb * loss;
  }

  // Sort for percentile computation
  annualLosses.sort((a, b) => a - b);

  // ALE = mean of all annual losses
  const ale = annualLosses.reduce((sum, v) => sum + v, 0) / iterations;

  // Percentiles
  const percentiles = computePercentiles(annualLosses, iterations);

  // Histogram with 30 contiguous bins
  const histogram = buildHistogram(annualLosses, iterations, HISTOGRAM_BINS);

  const durationMs = Date.now() - startMs;

  return { ale, percentiles, histogram, iterations, durationMs };
}

function computePercentiles(
  sorted: number[],
  n: number
): Record<string, number> {
  const pctKeys = [5, 10, 25, 50, 75, 90, 95, 99];
  const result: Record<string, number> = {};
  for (const p of pctKeys) {
    const idx = Math.min(Math.floor((p / 100) * n), n - 1);
    result[`p${p}`] = sorted[idx];
  }
  return result;
}

function buildHistogram(sorted: number[], n: number, bins: number): HistogramBin[] {
  const minVal = sorted[0];
  const maxVal = sorted[n - 1];

  // Edge case: all values identical
  if (minVal === maxVal) {
    const result: HistogramBin[] = [];
    for (let i = 0; i < bins; i++) {
      result.push({ min: minVal, max: maxVal, count: i === 0 ? n : 0 });
    }
    return result;
  }

  const binWidth = (maxVal - minVal) / bins;
  const histogram: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    min: minVal + i * binWidth,
    max: minVal + (i + 1) * binWidth,
    count: 0,
  }));

  for (const val of sorted) {
    let binIdx = Math.floor((val - minVal) / binWidth);
    // Clamp max value into last bin
    if (binIdx >= bins) binIdx = bins - 1;
    histogram[binIdx].count++;
  }

  return histogram;
}

// ─── Exceedance curve ─────────────────────────────────────────────────────────

/**
 * Build a loss exceedance curve from histogram bins.
 * Returns array of [loss_threshold, probability_of_exceedance].
 * y-values are monotonically non-increasing.
 */
export function buildExceedanceCurve(
  histogram: HistogramBin[],
  total: number
): Array<[number, number]> {
  const curve: Array<[number, number]> = [];
  let cumulative = 0;

  for (const bin of histogram) {
    // Probability of exceeding this bin's min threshold = 1 - cumulative P
    const pExceedance = 1 - cumulative / total;
    curve.push([bin.min, pExceedance]);
    cumulative += bin.count;
  }

  // Add final point at max value with probability 0
  const last = histogram[histogram.length - 1];
  curve.push([last.max, 0]);

  return curve;
}

// ─── Calibration ─────────────────────────────────────────────────────────────

interface CalibrationSignal {
  source: string;
  metadata: Record<string, unknown> | null | undefined;
  createdAt: Date;
}

export interface CalibrationResult {
  tef: TriangularParam | null;
  vulnerability: TriangularParam | null;
  lossMagnitude: TriangularParam | null;
  sampleSize: number;
  dataFreshness: string;
  message?: string;
}

const THREAT_LEVEL_SCORES: Record<string, number> = {
  undefined: 0.1,
  low: 0.15,
  medium: 0.35,
  high: 0.65,
  critical: 0.85,
};

/**
 * Aggregate signal metadata to produce FAIR parameter calibration suggestions.
 * Returns null for each param when insufficient data is available.
 *
 * Mapping logic:
 * - CVE CVSS avg → lossMagnitude (higher CVSS = higher loss)
 * - Signal frequency → TEF (events per 90-day window × 4 = annual)
 * - MISP threatLevel → vulnerability (qualitative → probability range)
 */
export function computeCalibration(signals: CalibrationSignal[]): CalibrationResult {
  const sampleSize = signals.length;

  if (sampleSize === 0) {
    return {
      tef: null,
      vulnerability: null,
      lossMagnitude: null,
      sampleSize: 0,
      dataFreshness: "no data",
      message: "Insufficient data",
    };
  }

  // ─── TEF: annualize event frequency from the sample window ────────────────

  let tef: TriangularParam | null = null;
  if (sampleSize >= 1) {
    // Estimate: signals observed in 90-day window → annualize ×4
    const annualized = sampleSize * 4;
    const variance = Math.max(1, Math.sqrt(annualized));
    tef = {
      min: Math.max(1, annualized - variance),
      mode: annualized,
      max: annualized + variance,
    };
  }

  // ─── Vulnerability: from MISP threat levels ────────────────────────────────

  const mispSignals = signals.filter((s) => s.source === "misp");
  let vulnerability: TriangularParam | null = null;

  if (mispSignals.length > 0) {
    const scores = mispSignals.map((s) => {
      const meta = (s.metadata ?? {}) as Record<string, unknown>;
      const level = String(meta.threatLevel ?? "").toLowerCase();
      return THREAT_LEVEL_SCORES[level] ?? 0.2;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    vulnerability = {
      min: Math.max(0, avg - 0.1),
      mode: Math.min(1, avg),
      max: Math.min(1, avg + 0.2),
    };
  } else if (sampleSize > 0) {
    // Generic fallback: moderate vulnerability when no MISP data
    vulnerability = { min: 0.1, mode: 0.25, max: 0.45 };
  }

  // ─── Loss Magnitude: from CVE CVSS scores ─────────────────────────────────

  const nvdSignals = signals.filter((s) => s.source === "nvd" || s.source === "cve");
  let lossMagnitude: TriangularParam | null = null;

  if (nvdSignals.length > 0) {
    const scores = nvdSignals
      .map((s) => {
        const meta = (s.metadata ?? {}) as Record<string, unknown>;
        return typeof meta.cvssScore === "number" ? meta.cvssScore : null;
      })
      .filter((s): s is number => s !== null);

    if (scores.length > 0) {
      const avgCvss = scores.reduce((a, b) => a + b, 0) / scores.length;
      // CVSS scale 0-10 → loss magnitude $10k - $10M
      // Exponential mapping: CVSS 5 ≈ $100k, CVSS 9 ≈ $2M, CVSS 2 ≈ $10k
      const base = 10_000 * Math.pow(10, avgCvss / 5);
      lossMagnitude = {
        min: Math.round(base * 0.2),
        mode: Math.round(base),
        max: Math.round(base * 3),
      };
    }
  }

  if (!lossMagnitude && sampleSize > 0) {
    // Generic fallback when no CVSS data
    lossMagnitude = { min: 10_000, mode: 50_000, max: 200_000 };
  }

  // ─── Data freshness ────────────────────────────────────────────────────────

  const newest = signals.reduce(
    (latest, s) => (s.createdAt > latest ? s.createdAt : latest),
    signals[0].createdAt
  );
  const ageDays = Math.floor((Date.now() - newest.getTime()) / (1000 * 60 * 60 * 24));
  const dataFreshness =
    ageDays === 0 ? "today" : ageDays === 1 ? "1 day ago" : `${ageDays} days ago`;

  return { tef, vulnerability, lossMagnitude, sampleSize, dataFreshness };
}
