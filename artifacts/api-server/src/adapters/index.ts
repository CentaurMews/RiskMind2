// ─── Adapter Registry Barrel ──────────────────────────────────────────────────
// Import this module once at startup (e.g., in index.ts or signal-feed-poller.ts)
// to populate the adapters registry with all concrete adapter instances.

import { adapters } from "./types.js";
import { nvdAdapter } from "./nvd.js";
import { shodanAdapter } from "./shodan.js";
import { sentinelAdapter } from "./sentinel.js";
import { mispAdapter } from "./misp.js";
import { emailAdapter } from "./email.js";

adapters["nvd"] = nvdAdapter;
adapters["shodan"] = shodanAdapter;
adapters["sentinel"] = sentinelAdapter;
adapters["misp"] = mispAdapter;
adapters["email"] = emailAdapter;

export { adapters };
