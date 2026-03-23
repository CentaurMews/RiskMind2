// ─── Adapter Registry Barrel ──────────────────────────────────────────────────
// Import this module once at startup (e.g., in index.ts or signal-feed-poller.ts)
// to populate the adapters registry with all concrete adapter instances.

import { adapters } from "./types.js";
import { nvdAdapter } from "./nvd.js";
import { shodanAdapter } from "./shodan.js";

adapters["nvd"] = nvdAdapter;
adapters["shodan"] = shodanAdapter;

// Sentinel, MISP, Email adapters registered in Plans 03 and 04.

export { adapters };
