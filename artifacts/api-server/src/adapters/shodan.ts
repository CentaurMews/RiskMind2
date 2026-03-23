import { pRateLimit } from "p-ratelimit";
import { db, vendorsTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import {
  type SignalFeedAdapter,
  type RawSignal,
  type DecryptedConfig,
  type ShodanConfig,
  computeContentHash,
} from "./types.js";

// ─── Rate limiter: 1 req/sec (Shodan free tier limit) ─────────────────────────
const limiter = pRateLimit({ interval: 1_000, rate: 1, concurrency: 1 });

// ─── Internal Shodan response types ──────────────────────────────────────────

interface ShodanService {
  port: number;
  transport: string;
  product?: string;
  version?: string;
  vulns?: Record<string, { cvss: number; summary: string }>;
}

interface ShodanHostResponse {
  ip_str: string;
  ports: number[];
  data: ShodanService[];
  last_update?: string;
}

interface ShodanApiInfo {
  plan: string;
  scan_credits: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract domain from a contact email address.
 * Returns null for generic free-tier domains that would produce noisy results.
 */
function extractDomainFromEmail(email: string | null): string | null {
  if (!email) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase().trim();

  // Skip generic free-tier email providers
  const blocklist = new Set([
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "live.com", "icloud.com", "protonmail.com", "proton.me",
  ]);
  if (blocklist.has(domain)) return null;
  return domain;
}

interface DnsResolveResponse {
  [hostname: string]: string;
}

async function resolveDomainToIPs(
  domain: string,
  apiKey: string
): Promise<string[]> {
  const res = await fetch(
    `https://api.shodan.io/dns/resolve?hostnames=${encodeURIComponent(domain)}&key=${apiKey}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as DnsResolveResponse;
  const ip = data[domain];
  return ip ? [ip] : [];
}

async function queryHostData(
  ip: string,
  apiKey: string
): Promise<ShodanHostResponse | null> {
  const res = await fetch(
    `https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Shodan host query ${res.status} for ${ip}: ${await res.text()}`);
  }
  return res.json() as Promise<ShodanHostResponse>;
}

// ─── Adapter implementation ───────────────────────────────────────────────────

const shodanAdapter: SignalFeedAdapter = {
  type: "shodan",

  async poll(config: DecryptedConfig, _since: Date): Promise<RawSignal[]> {
    if (config.type !== "shodan") return [];
    const cfg = config as ShodanConfig;

    // Fetch all vendors that have a contact email (domain source)
    const vendors = await db
      .select({
        id: vendorsTable.id,
        tenantId: vendorsTable.tenantId,
        name: vendorsTable.name,
        contactEmail: vendorsTable.contactEmail,
      })
      .from(vendorsTable)
      .where(isNotNull(vendorsTable.contactEmail));

    const signals: RawSignal[] = [];

    for (const vendor of vendors) {
      const domain = extractDomainFromEmail(vendor.contactEmail);
      if (!domain) continue;

      // Step 1: DNS resolve domain to IPs
      const ips = await limiter(() => resolveDomainToIPs(domain, cfg.apiKey));
      if (ips.length === 0) continue;

      // Step 2: Query each IP for host data
      for (const ip of ips) {
        let host: ShodanHostResponse | null;
        try {
          host = await limiter(() => queryHostData(ip, cfg.apiKey));
        } catch {
          // Non-fatal — skip this IP
          continue;
        }
        if (!host) continue;

        // Extract services list
        const services = host.data.map((svc) => ({
          port: svc.port,
          transport: svc.transport,
          product: svc.product ?? null,
          version: svc.version ?? null,
        }));

        // Extract CVE IDs from all services
        const vulnCveIds: string[] = [];
        for (const svc of host.data) {
          if (svc.vulns) {
            vulnCveIds.push(...Object.keys(svc.vulns));
          }
        }

        // Sort for deterministic hashing
        const sortedPorts = [...(host.ports ?? [])].sort((a, b) => a - b);
        const sortedVulns = [...vulnCveIds].sort();

        // Normalize content for content hash
        const normalizedContent = JSON.stringify({
          ip,
          ports: sortedPorts,
          vulns: sortedVulns,
        });
        const contentHash = computeContentHash(normalizedContent);

        // Human-readable content
        const portList = sortedPorts.join(", ") || "none";
        const serviceList = services
          .map((s) => `${s.product ?? "unknown"}:${s.port}`)
          .join(", ") || "none";
        const vulnList = sortedVulns.join(", ") || "none";
        const content =
          `Shodan scan for ${domain} (${ip}): ${sortedPorts.length} open ports [${portList}]. ` +
          `Services: ${serviceList}. CVEs: ${vulnList}`;

        signals.push({
          content,
          contentHash,
          externalId: `shodan-${ip}`,
          vendorId: vendor.id,
          metadata: {
            ip,
            domain,
            ports: sortedPorts,
            services,
            vulns: sortedVulns,
            lastUpdate: host.last_update ?? null,
          },
          sourceEventTimestamp: host.last_update
            ? new Date(host.last_update)
            : undefined,
        });
      }
    }

    return signals;
  },

  async testConnection(
    config: DecryptedConfig
  ): Promise<{ ok: boolean; message: string }> {
    if (config.type !== "shodan") {
      return { ok: false, message: "Invalid config type for Shodan adapter" };
    }
    const cfg = config as ShodanConfig;

    try {
      const res = await fetch(
        `https://api.shodan.io/api-info?key=${cfg.apiKey}`
      );
      if (res.ok) {
        const data = (await res.json()) as ShodanApiInfo;
        return {
          ok: true,
          message: `Shodan API key valid. Plan: ${data.plan}. Scan credits: ${data.scan_credits}.`,
        };
      }
      return {
        ok: false,
        message: `Invalid Shodan API key (HTTP ${res.status})`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  },
};

export { shodanAdapter };
