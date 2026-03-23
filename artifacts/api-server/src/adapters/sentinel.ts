import { ClientSecretCredential } from "@azure/identity";
import {
  type SignalFeedAdapter,
  type RawSignal,
  type DecryptedConfig,
  type SentinelConfig,
  computeContentHash,
} from "./types.js";

// ─── Internal Log Analytics response types ───────────────────────────────────

interface LogAnalyticsColumn {
  name: string;
  type: string;
}

interface LogAnalyticsTable {
  columns: LogAnalyticsColumn[];
  rows: unknown[][];
}

interface LogAnalyticsResponse {
  tables: LogAnalyticsTable[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getLogAnalyticsToken(config: SentinelConfig): Promise<string> {
  const credential = new ClientSecretCredential(
    config.azureTenantId,
    config.clientId,
    config.clientSecret
  );
  const tokenResponse = await credential.getToken(
    "https://api.loganalytics.io/.default"
  );
  if (!tokenResponse?.token) {
    throw new Error("Failed to acquire Log Analytics token from Azure AD");
  }
  return tokenResponse.token;
}

async function queryLogAnalytics(
  config: SentinelConfig,
  kql: string
): Promise<Record<string, unknown>[]> {
  const token = await getLogAnalyticsToken(config);

  const res = await fetch(
    `https://api.loganalytics.io/v1/workspaces/${config.workspaceId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: kql }),
    }
  );

  if (!res.ok) {
    throw new Error(
      `Log Analytics API ${res.status}: ${await res.text()}`
    );
  }

  const data = (await res.json()) as LogAnalyticsResponse;
  const table = data.tables?.[0];
  if (!table) return [];

  // Map column names to row values to produce an array of objects
  const columns = table.columns.map((c) => c.name);
  return table.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((colName, idx) => {
      obj[colName] = row[idx];
    });
    return obj;
  });
}

// ─── Adapter implementation ───────────────────────────────────────────────────

const sentinelAdapter: SignalFeedAdapter = {
  type: "sentinel",

  async poll(config: DecryptedConfig, since: Date): Promise<RawSignal[]> {
    if (config.type !== "sentinel") return [];
    const cfg = config as SentinelConfig;

    const kql = `SecurityIncident | where TimeGenerated > datetime(${since.toISOString()}) | project IncidentNumber, Title, Description, Severity, Status, Classification, CreatedTime, ClosedTime, Owner, AlertIds | order by TimeGenerated desc | take 500`;

    const incidents = await queryLogAnalytics(cfg, kql);
    const signals: RawSignal[] = [];

    for (const incident of incidents) {
      const incidentNumber = incident["IncidentNumber"];
      const title = (incident["Title"] as string) ?? "";
      const description = (incident["Description"] as string) ?? "";
      const severity = (incident["Severity"] as string) ?? "Unknown";
      const status = (incident["Status"] as string) ?? "Unknown";
      const classification = (incident["Classification"] as string) ?? null;
      const createdTime = incident["CreatedTime"] as string | null;
      const closedTime = incident["ClosedTime"] as string | null;
      const owner = incident["Owner"];
      const alertIds = incident["AlertIds"];

      // Deterministic content for stable hash (incident number is stable)
      const normalizedContent = JSON.stringify({ incidentNumber, title });
      const contentHash = computeContentHash(normalizedContent);

      const content = `[Sentinel] ${severity} incident: ${title}. ${description}`;

      signals.push({
        content,
        contentHash,
        externalId: `sentinel-${incidentNumber}`,
        metadata: {
          incidentNumber,
          title,
          description,
          severity,
          status,
          classification,
          createdTime,
          closedTime,
          owner,
          alertIds,
        },
        sourceEventTimestamp: createdTime ? new Date(createdTime) : undefined,
      });
    }

    return signals;
  },

  async testConnection(
    config: DecryptedConfig
  ): Promise<{ ok: boolean; message: string }> {
    if (config.type !== "sentinel") {
      return { ok: false, message: "Invalid config type for Sentinel adapter" };
    }
    const cfg = config as SentinelConfig;

    try {
      await queryLogAnalytics(cfg, "SecurityIncident | take 1");
      return {
        ok: true,
        message:
          "Connected to Log Analytics workspace. Sentinel incidents accessible.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Failed to connect: ${message}. Verify Tenant ID, Client ID, Client Secret, and Workspace ID. Ensure app registration has Log Analytics Reader role.`,
      };
    }
  },
};

export { sentinelAdapter };
