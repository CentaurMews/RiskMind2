// ─── Adapter Registry Barrel ──────────────────────────────────────────────────
// Import this module once at startup (e.g., in index.ts or signal-feed-poller.ts)
// to populate the adapters registry with all concrete adapter instances.

import { adapters } from "./types.js";
import { nvdAdapter } from "./nvd.js";

adapters["nvd"] = nvdAdapter;

// Shodan adapter will be registered here after Plan 02 Task 2.
// Sentinel, MISP, Email adapters registered in Plans 03 and 04.

export { adapters };
