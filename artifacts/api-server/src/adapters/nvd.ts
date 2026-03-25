import { pRateLimit } from "p-ratelimit";
import {
  type SignalFeedAdapter,
  type RawSignal,
  type DecryptedConfig,
  type NvdConfig,
  computeContentHash,
} from "./types.js";

// ─── Rate limiter: 45 req per 30 seconds (under NVD's 50 req/30s cap) ────────
const limiter = pRateLimit({ interval: 30_000, rate: 45, concurrency: 1 });

// ─── Internal NVD API response types ─────────────────────────────────────────

interface CvssMetric {
  cvssData: {
    baseScore: number;
    vectorString: string;
  };
}

interface CveDescription {
  lang: string;
  value: string;
}

interface CveReference {
  url: string;
  source?: string;
}

interface CveConfiguration {
  nodes?: Array<{
    cpeMatch?: Array<{ criteria: string }>;
  }>;
}

interface CveItem {
  id: string;
  descriptions: CveDescription[];
  published: string;
  lastModified: string;
  metrics?: {
    cvssMetricV31?: CvssMetric[];
    cvssMetricV30?: CvssMetric[];
    cvssMetricV2?: CvssMetric[];
  };
  references?: CveReference[];
  configurations?: CveConfiguration[];
}

interface NvdPage {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: Array<{ cve: CveItem }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCvss(cve: CveItem): { baseScore: number | null; vector: string | null } {
  const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
  if (v31) return { baseScore: v31.baseScore, vector: v31.vectorString };
  const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
  if (v30) return { baseScore: v30.baseScore, vector: v30.vectorString };
  const v2 = cve.metrics?.cvssMetricV2?.[0]?.cvssData;
  if (v2) return { baseScore: v2.baseScore, vector: v2.vectorString };
  return { baseScore: null, vector: null };
}

async function fetchNvdPage(
  apiKey: string | undefined,
  params: URLSearchParams,
  startIndex: number
): Promise<NvdPage> {
  const p = new URLSearchParams(params);
  p.set("startIndex", String(startIndex));
  p.set("resultsPerPage", "2000");

  const headers: Record<string, string> = {};
  if (apiKey) headers["apiKey"] = apiKey;

  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?${p.toString()}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    throw new Error(`NVD API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<NvdPage>;
}

// ─── Adapter implementation ───────────────────────────────────────────────────

const nvdAdapter: SignalFeedAdapter = {
  type: "nvd",

  async poll(config: DecryptedConfig, since: Date): Promise<RawSignal[]> {
    if (config.type !== "nvd") return [];
    const cfg = config as NvdConfig;

    const params = new URLSearchParams({
      lastModStartDate: since.toISOString(),
      lastModEndDate: new Date().toISOString(),
    });

    if (cfg.keywords && cfg.keywords.length > 0) {
      params.set("keywordSearch", cfg.keywords.join(","));
    }

    // Fetch page 0 and determine total
    const page0 = await limiter(() => fetchNvdPage(cfg.apiKey, params, 0));
    const totalResults = page0.totalResults;
    const allVulnerabilities = [...page0.vulnerabilities];

    // Paginate through remaining pages
    for (let start = 2000; start < totalResults; start += 2000) {
      const page = await limiter(() => fetchNvdPage(cfg.apiKey, params, start));
      allVulnerabilities.push(...page.vulnerabilities);
    }

    // Map each CVE to a RawSignal
    const signals: RawSignal[] = [];

    for (const { cve } of allVulnerabilities) {
      const cveId = cve.id;
      const { baseScore, vector } = extractCvss(cve);
      const description =
        cve.descriptions.find((d) => d.lang === "en")?.value ?? "";

      // Normalized content for deterministic hashing
      const normalizedContent = JSON.stringify({
        id: cveId,
        cvssV3: baseScore,
        description,
      });

      const contentHash = computeContentHash(normalizedContent);

      // Human-readable content
      const scoreStr = baseScore !== null ? String(baseScore) : "N/A";
      const content = `[${cveId}] (CVSS ${scoreStr}) ${description}`;

      // Affected products from configurations
      const affectedProducts: string[] = [];
      if (cve.configurations) {
        for (const cfg of cve.configurations) {
          for (const node of cfg.nodes ?? []) {
            for (const match of node.cpeMatch ?? []) {
              affectedProducts.push(match.criteria);
            }
          }
        }
      }

      const references = (cve.references ?? []).map((r) => r.url);

      signals.push({
        content,
        contentHash,
        externalId: cveId,
        metadata: {
          cveId,
          cvssV3BaseScore: baseScore,
          cvssVector: vector,
          publishedDate: cve.published,
          lastModifiedDate: cve.lastModified,
          references,
          affectedProducts,
        },
        sourceEventTimestamp: new Date(cve.published),
      });
    }

    return signals;
  },

  async testConnection(
    config: DecryptedConfig
  ): Promise<{ ok: boolean; message: string }> {
    if (config.type !== "nvd") {
      return { ok: false, message: "Invalid config type for NVD adapter" };
    }
    const cfg = config as NvdConfig;

    try {
      const headers: Record<string, string> = {};
      if (cfg.apiKey) headers["apiKey"] = cfg.apiKey;

      const res = await fetch(
        "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1",
        { headers, signal: AbortSignal.timeout(20_000) }
      );

      if (res.ok) {
        const keyStatus = cfg.apiKey ? "configured" : "not set (rate-limited)";
        return {
          ok: true,
          message: `NVD API reachable. API key: ${keyStatus}.`,
        };
      }
      return {
        ok: false,
        message: `NVD API returned ${res.status}: ${await res.text()}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  },
};

export { nvdAdapter };
