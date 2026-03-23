import {
  type SignalFeedAdapter,
  type RawSignal,
  type DecryptedConfig,
  type MispConfig,
  computeContentHash,
} from "./types.js";

// ─── Threat level mapping ─────────────────────────────────────────────────────

const THREAT_LEVEL_LABELS: Record<number, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
  4: "Undefined",
};

// ─── Internal MISP response types ────────────────────────────────────────────

interface MispAttribute {
  type: string;
  value: string;
  category?: string;
  to_ids?: boolean;
}

interface MispTag {
  name: string;
}

interface MispOrg {
  name: string;
}

interface MispEvent {
  id: string;
  info: string;
  threat_level_id: string;
  date: string;
  Org?: MispOrg;
  Attribute?: MispAttribute[];
  Tag?: MispTag[];
}

interface MispSearchResponse {
  response: MispEvent[];
}

interface MispGroupedAttributes {
  ips: string[];
  domains: string[];
  hashes: string[];
  cves: string[];
  emails: string[];
  urls: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function mispFetch(
  config: MispConfig,
  path: string,
  body?: object
): Promise<unknown> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: config.apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`MISP API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

function groupAttributes(attributes: MispAttribute[]): MispGroupedAttributes {
  const grouped: MispGroupedAttributes = {
    ips: [],
    domains: [],
    hashes: [],
    cves: [],
    emails: [],
    urls: [],
  };

  for (const attr of attributes) {
    const val = attr.value;
    if (attr.type === "ip-src" || attr.type === "ip-dst") {
      grouped.ips.push(val);
    } else if (attr.type === "domain" || attr.type === "hostname") {
      grouped.domains.push(val);
    } else if (
      attr.type === "md5" ||
      attr.type === "sha1" ||
      attr.type === "sha256"
    ) {
      grouped.hashes.push(val);
    } else if (attr.type === "vulnerability") {
      grouped.cves.push(val);
    } else if (attr.type === "email-src" || attr.type === "email-dst") {
      grouped.emails.push(val);
    } else if (attr.type === "url") {
      grouped.urls.push(val);
    }
  }

  return grouped;
}

function buildIocSummary(grouped: MispGroupedAttributes): string {
  const parts: string[] = [];
  if (grouped.ips.length > 0)
    parts.push(`${grouped.ips.length} IP(s)`);
  if (grouped.domains.length > 0)
    parts.push(`${grouped.domains.length} domain(s)`);
  if (grouped.hashes.length > 0)
    parts.push(`${grouped.hashes.length} hash(es)`);
  if (grouped.cves.length > 0)
    parts.push(`${grouped.cves.length} CVE(s)`);
  if (grouped.emails.length > 0)
    parts.push(`${grouped.emails.length} email(s)`);
  if (grouped.urls.length > 0)
    parts.push(`${grouped.urls.length} URL(s)`);
  return parts.length > 0 ? parts.join(", ") : "no IoCs";
}

// ─── Adapter implementation ───────────────────────────────────────────────────

const mispAdapter: SignalFeedAdapter = {
  type: "misp",

  async poll(config: DecryptedConfig, since: Date): Promise<RawSignal[]> {
    if (config.type !== "misp") return [];
    const cfg = config as MispConfig;

    const searchBody: Record<string, unknown> = {
      timestamp: Math.floor(since.getTime() / 1000),
      limit: 500,
      page: 1,
      includeAttributes: true,
    };

    // Apply optional filters
    if (cfg.eventFilters?.minThreatLevel !== undefined) {
      searchBody["threat_level_id"] = cfg.eventFilters.minThreatLevel;
    }
    if (cfg.eventFilters?.tags && cfg.eventFilters.tags.length > 0) {
      searchBody["tags"] = cfg.eventFilters.tags;
    }

    const response = (await mispFetch(
      cfg,
      "/events/restSearch",
      searchBody
    )) as MispSearchResponse;

    const events: MispEvent[] = response?.response ?? [];
    const signals: RawSignal[] = [];

    for (const event of events) {
      const eventId = event.id;
      const info = event.info ?? "";
      const threatLevelId = parseInt(event.threat_level_id ?? "4", 10);
      const threatLevelLabel =
        THREAT_LEVEL_LABELS[threatLevelId] ?? "Undefined";
      const orgName = event.Org?.name ?? "Unknown";
      const attributes = event.Attribute ?? [];
      const groupedAttributes = groupAttributes(attributes);
      const iocSummary = buildIocSummary(groupedAttributes);
      const tags = (event.Tag ?? []).map((t) => t.name);

      // Deterministic content for stable hash (event ID is stable)
      const normalizedContent = JSON.stringify({ eventId, info });
      const contentHash = computeContentHash(normalizedContent);

      const content = `[MISP] ${info} (Threat Level: ${threatLevelLabel}). IoCs: ${iocSummary}`;

      signals.push({
        content,
        contentHash,
        externalId: `misp-${eventId}`,
        metadata: {
          eventId,
          info,
          threatLevel: threatLevelId,
          orgName,
          date: event.date,
          attributes: groupedAttributes,
          attributeCount: attributes.length,
          tags,
        },
        sourceEventTimestamp: event.date ? new Date(event.date) : undefined,
      });
    }

    return signals;
  },

  async testConnection(
    config: DecryptedConfig
  ): Promise<{ ok: boolean; message: string }> {
    if (config.type !== "misp") {
      return { ok: false, message: "Invalid config type for MISP adapter" };
    }
    const cfg = config as MispConfig;

    try {
      const data = (await mispFetch(cfg, "/users/view/me")) as {
        User?: { org_id?: string };
      };
      const orgId = data?.User?.org_id ?? "unknown";
      return {
        ok: true,
        message: `Connected to MISP instance at ${cfg.baseUrl}. Org: ${orgId}.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Failed to connect to MISP: ${message}`,
      };
    }
  },
};

export { mispAdapter };
