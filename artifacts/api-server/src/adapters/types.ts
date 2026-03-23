import { createHash } from "crypto";

// ─── Per-source credential config types ──────────────────────────────────────

export interface NvdConfig {
  type: "nvd";
  apiKey?: string;
  keywords: string[];
}

export interface ShodanConfig {
  type: "shodan";
  apiKey: string;
}

export interface SentinelConfig {
  type: "sentinel";
  azureTenantId: string;
  clientId: string;
  clientSecret: string;
  workspaceId: string;
}

export interface MispConfig {
  type: "misp";
  baseUrl: string;
  apiKey: string;
  eventFilters?: {
    minThreatLevel?: number;
    tags?: string[];
  };
}

export interface EmailConfig {
  type: "email";
  host: string;
  port: number;
  user: string;
  pass: string;
  tls: boolean;
  mailbox?: string;
  /** Injected at poll time by signal-feed-poller — not stored in encryptedConfig */
  tenantId?: string;
}

export type DecryptedConfig =
  | NvdConfig
  | ShodanConfig
  | SentinelConfig
  | MispConfig
  | EmailConfig;

// ─── Raw signal shape returned by adapters ───────────────────────────────────

export interface RawSignal {
  content: string;
  contentHash: string;
  externalId?: string;
  vendorId?: string;
  metadata: Record<string, unknown>;
  sourceEventTimestamp?: Date;
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface SignalFeedAdapter {
  readonly type: "nvd" | "shodan" | "sentinel" | "misp" | "email";
  poll(config: DecryptedConfig, since: Date): Promise<RawSignal[]>;
  testConnection(config: DecryptedConfig): Promise<{ ok: boolean; message: string }>;
}

// ─── Adapter registry (populated by concrete adapter modules) ─────────────────

export const adapters: Record<string, SignalFeedAdapter> = {};

// Adapters are registered by importing this barrel module.
// Each concrete adapter file calls: adapters["<type>"] = <adapterInstance>
// Do not import adapters here — use src/adapters/index.ts barrel instead.

// ─── Utility ─────────────────────────────────────────────────────────────────

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}
