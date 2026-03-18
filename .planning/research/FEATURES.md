# Feature Research

**Domain:** LLM Configuration Wizard + Model Routing (RiskMind v1.1)
**Researched:** 2026-03-18
**Confidence:** HIGH (Anthropic API docs confirmed, RouteLLM research verified, industry patterns confirmed via multiple sources)

---

## Context: What This Covers

This document augments the v1.0 ERM feature research with v1.1-specific feature analysis. Focus areas:

1. **LLM Config Wizard** — guided provider onboarding with auto-discovery
2. **Intelligent Model Router** — per-task model assignment
3. **Bug Fixes (7 items)** — correctness and UX repair from v1.0 audit
4. **Foresight Teaser** — polished preview page replacing bare stub

The v1.0 FEATURES.md remains valid for core ERM features. This document covers the LLM intelligence layer added in v1.1.

---

## Key Research Finding: Anthropic Now Has a List Endpoint

The v1.1 scope document states "Anthropic: hardcoded model list (no list endpoint)" — this is **outdated**.

Anthropic now provides `GET /v1/models` returning `id`, `display_name`, `created_at`, `type`. This means the wizard can auto-fetch Anthropic models the same way it fetches OpenAI models.

**Source:** [Anthropic API Reference — List Models](https://platform.claude.com/docs/en/api/models/list) — HIGH confidence

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any operator adding an LLM provider to a SaaS tool expects. Missing these makes the integration feel unfinished or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Provider dropdown with known providers** | Users expect a list of well-known providers, not a blank text field | LOW | OpenAI, Anthropic, Google, Mistral, Groq, Together AI, Ollama — 7 providers covers >95% of real usage |
| **API key input with masking** | Standard credential UX — show asterisks, never expose raw key | LOW | Input type="password" + show/hide toggle; key encrypted at rest (AES-256-GCM already in stack) |
| **Base URL input for self-hosted/Ollama** | Private deployments need custom endpoints | LOW | Only shown when provider is Ollama or custom; pre-filled with sensible default (http://localhost:11434) |
| **Test connection button** | Users must verify credentials before saving — otherwise silent misconfiguration | LOW | Single API call to a cheap endpoint (e.g., list models); show success/failure inline |
| **Auto-fetch available models** | Users should not manually type model IDs — typos cause silent failures | MEDIUM | All 7 providers now support this: OpenAI `GET /v1/models`, Anthropic `GET /v1/models`, Ollama `GET /api/tags`, others provider-specific |
| **Model name display (not raw ID)** | `claude-sonnet-4-6` means nothing to users; `Claude Sonnet 4.6` is readable | LOW | Map raw IDs to display names; fall back to raw ID if unknown |
| **Save configuration** | Obvious — user must be able to persist their settings | LOW | Existing `llm_configs` table and API; encrypted key storage already works |
| **Edit / delete existing configs** | Users rotate API keys and change providers | LOW | CRUD operations on existing configs already exists in the API |
| **Connection status indicator** | Users must know at a glance whether a config is working | LOW | Green/red/grey badge on each saved config; trigger a periodic health ping or on-demand retest |
| **Error message clarity on failure** | "Invalid API key" is helpful; "Error 401" is not | LOW | This is one of the 7 audit bugs — vendor AI returns confusing 400; must surface 502/clear message |

### Differentiators (Competitive Advantage)

Features that go beyond baseline expectations and create genuine value for an AI-native platform.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Model benchmarking (latency + quality)** | Users can see which model is fastest/best before committing to it for a task | MEDIUM | Run standard prompt against each selected model; measure TTFT + total latency; simple 1-3 quality signal (e.g., response coherence check); display results in Step 5 of wizard |
| **Per-task model routing table** | Right-size model to task: cheap fast model for triage, reasoning model for enrichment | MEDIUM | 6 task types in scope: Risk Enrichment, Signal Triage, Treatment Suggestions, Embeddings, Agent Reasoning, General; visual table in Settings with dropdown per task |
| **Smart routing defaults from benchmarks** | Suggest "use model X for triage (cheapest fast)" based on benchmark results | MEDIUM | After benchmarking, pre-fill routing table with sensible suggestions; user can override; reduces cognitive load |
| **Embeddings health warning** | Warn when no embeddings provider is configured — semantic search and agent clustering silently degrade | LOW | This is one of the 7 audit bugs; banner in Settings page: "Warning: No embeddings provider configured. Semantic search and signal correlation are disabled." |
| **Model name validation** | Prevent saving incorrect model IDs (the "Haiku" bug — must be `claude-haiku-4-5` not `haiku`) | LOW | Validate model ID against fetched list; if user types manually, warn when ID doesn't match known pattern |
| **Wizard step-by-step progress** | Multi-step onboarding is less intimidating than a large form; progress indicator shows where you are | LOW | 6 steps matching the scope doc; progress bar or numbered steps; back/next navigation |
| **Multiple configs per tenant** | Different tasks might use different providers (e.g., Anthropic for reasoning, Ollama for embeddings) | LOW | Existing architecture already supports multiple `llm_configs` per tenant; expose this in UI clearly |
| **Foresight teaser page** | Builds anticipation for v2 features; turns a missing feature into a marketing moment | MEDIUM | Monte Carlo simulation, OSINT forecasting, agent feed, what-if scenarios previewed visually; Apple keynote aesthetic |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful but add disproportionate complexity or risk for the v1.1 milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automatic key rotation** | "We should rotate API keys on a schedule" | Key rotation requires re-encrypting all stored configs; the PROJECT.md constraint explicitly calls this out as a risk; it's also a key management problem better solved at the provider level | Let users rotate manually; document the constraint; v2 can add a re-encryption migration tool |
| **LLM cost tracking / token analytics** | "I want to see what AI is costing me" | Per-token cost tracking requires logging every LLM call with token counts; this is a meaningful infrastructure addition; explicitly deferred to v2 in PROJECT.md | Show it as a Foresight/v2 teaser; don't half-implement it in v1.1 |
| **Automatic failover between models** | "If OpenAI is down, fall back to Anthropic automatically" | Failover logic adds state (which models are healthy?), retry semantics, and potential cost surprises; 2026 research confirms this is easy to get wrong (silent fallback to expensive model) | Manual fallback config in routing table is sufficient; automatic failover is v2 |
| **AI-scored model quality benchmarks** | "Use another LLM to judge the response quality of tested models" | LLM-judge benchmarking adds a meta-LLM call, cost, latency, and requires a reference answer; significant complexity for a setup wizard | Use simpler quality heuristics: response length, format compliance, time-to-first-token |
| **Streaming benchmark results** | "Show tokens arriving in real-time during benchmark" | Streaming adds WebSocket or SSE complexity to what is fundamentally a one-time setup step | Show a loading spinner and summary results after completion |
| **Provider marketplace / discovery** | "Browse available providers I haven't configured yet" | Requires maintaining a provider catalog with current pricing, model specs, availability — a full-time maintenance burden | Hardcode the 7 known providers with sensible defaults; Ollama/custom covers the long tail |
| **Global (cross-tenant) routing defaults** | "Set a default routing table that all new tenants inherit" | Breaks tenant isolation guarantees; each tenant's keys are scoped to their account | Per-tenant routing is the correct architecture; global defaults are an admin-only v2 feature if needed |

---

## Feature Dependencies

```
[LLM Config — Provider + API Key]
    └──required by──> [Auto-Fetch Models]
    └──required by──> [Test Connection]
    └──required by──> [Benchmarking]
    └──required by──> [Save Config]

[Auto-Fetch Models]
    └──required by──> [Model Picker (Step 4)]
    └──required by──> [Model Name Validation]

[Benchmarking (Step 5)]
    └──enhances──> [Smart Routing Defaults]

[Smart Routing Defaults]
    └──enhances──> [Per-Task Routing Table]

[Per-Task Routing Table (Settings)]
    └──required by──> [Intelligent Model Router (backend resolveConfig)]

[Intelligent Model Router]
    └──required by──> [Risk Enrichment uses correct model]
    └──required by──> [Signal Triage uses correct model]
    └──required by──> [Treatment Suggestions uses correct model]
    └──required by──> [Agent Reasoning uses correct model]
    └──required by──> [Embeddings uses correct model]

[Embeddings Provider Configured]
    └──required by──> [Semantic Search (⌘K)]
    └──required by──> [Agent Signal Clustering]
    └──required by──> [Signal Correlation]

[Embeddings Health Check Warning]
    └──surfaces──> [Missing Embeddings Provider]

[Bug Fix: Persist Agent Findings Before LLM Call]
    └──fixes──> [Agent Local Findings Lost on LLM Error]

[Bug Fix: Replace Instead of Append Enrichment Block]
    └──fixes──> [Duplicate AI Enrichment Stacking]

[Bug Fix: 502 on LLM Parse Failure]
    └──fixes──> [Confusing 400 on Vendor AI Questions]

[Bug Fix: Vendor Scorecard Real Data]
    └──removes──> [Placeholder lastAssessmentDate + openFindingsCount]
```

### Dependency Notes

- **Auto-fetch models requires provider + key first:** The wizard cannot list models until the API key is validated. Step 3 (Connect) must succeed before Step 4 (Model picker) is available.
- **Benchmarking requires model selection:** You can only benchmark models that have been fetched and selected. Benchmarking is Step 5, after model picking in Step 4.
- **Smart defaults require benchmarking:** Pre-filling the routing table is only meaningful if benchmark data (latency, quality) exists. If user skips benchmarking, routing table shows empty/manual mode.
- **Routing table drives backend resolveConfig:** The UI routing table is only valuable if the backend actually uses it. These must ship together.
- **Embeddings health check is standalone:** It does not depend on the wizard — it's a read of existing config state. It can ship independently of the wizard.
- **Bug fixes are independent of each other:** Each of the 7 bugs can be fixed in isolation. No sequencing dependency between them.

---

## v1.1 Feature Definition

### Wizard: Must-Have Steps (Launch With)

The wizard has no value if any of these are missing.

- [ ] **Step 1: Nickname + provider dropdown** — name the config, pick provider from list of 7
- [ ] **Step 2: API key + optional base URL** — masked input, help text per provider
- [ ] **Step 3: Test connection + fetch models** — single button, inline result, model list returned
- [ ] **Step 4: Model selection** — multi-select from fetched list; display names not raw IDs
- [ ] **Step 5: Benchmark selected models** — measure latency, show results; can skip
- [ ] **Step 6: Save + assign to task types** — confirm config, initial routing suggestions

### Router: Must-Have (Launch With)

- [ ] **Visual routing table in Settings** — 6 task types, dropdown per task pointing to available configs/models
- [ ] **Backend resolveConfig accepts task type** — actually routes to assigned model
- [ ] **Model name validation** — error if saved model ID doesn't match a known model from the provider

### Bug Fixes: All 7 Required

These are correctness issues, not features. All 7 must ship.

- [ ] **Doc processor** — real parsing or explicit "coming soon" (no hallucinated summaries)
- [ ] **Agent findings persistence** — persist local findings before `reason()` call
- [ ] **Duplicate enrichment** — detect and replace existing enrichment block
- [ ] **Vendor AI 400 → 502** — return appropriate HTTP status + clear message on LLM parse failure
- [ ] **Vendor scorecard real data** — compute `lastAssessmentDate` and `openFindingsCount` from DB
- [ ] **Embeddings health warning** — Settings banner when no embeddings provider configured
- [ ] **Model name validation** — prevent saving mismatched model IDs

### Foresight Teaser: Must-Have (Launch With)

- [ ] **Polished "Coming Soon" page** — replaces bare stub; Apple keynote aesthetic
- [ ] **Feature previews for 4 planned capabilities** — Monte Carlo, OSINT, agent feed, what-if builder
- [ ] **Visual design that builds anticipation** — screenshots/mockups or illustrated concepts, not just text bullets

### Add After Validation (v1.x — Post v1.1)

- [ ] **Token cost analytics** — per-call cost tracking and dashboard; requires logging infrastructure
- [ ] **Automatic model failover** — retry with secondary model on primary failure
- [ ] **LLM observability** — request/response logging for debugging enrichment quality

### Future Consideration (v2+)

- [ ] **Key rotation with re-encryption** — rotate ENCRYPTION_KEY and re-encrypt all stored keys
- [ ] **AI-judged model quality scoring** — LLM-as-judge for benchmark quality assessment
- [ ] **Cross-tenant routing defaults** — admin-set baseline routing that tenants can override

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Wizard Step 1-3 (provider, key, test) | HIGH | LOW | P1 |
| Wizard Step 4 (model picker) | HIGH | LOW | P1 |
| Wizard Step 6 (save + routing) | HIGH | LOW | P1 |
| Backend resolveConfig with task type | HIGH | MEDIUM | P1 |
| Bug fix: agent findings persistence | HIGH | LOW | P1 |
| Bug fix: duplicate enrichment | HIGH | LOW | P1 |
| Bug fix: vendor 400 → 502 | MEDIUM | LOW | P1 |
| Bug fix: vendor scorecard real data | HIGH | MEDIUM | P1 |
| Bug fix: model name validation | MEDIUM | LOW | P1 |
| Embeddings health warning | MEDIUM | LOW | P1 |
| Visual routing table in Settings | HIGH | MEDIUM | P1 |
| Wizard Step 5 (benchmarking) | MEDIUM | MEDIUM | P2 |
| Smart routing defaults from benchmark | MEDIUM | MEDIUM | P2 |
| Bug fix: doc processor | MEDIUM | MEDIUM | P2 |
| Foresight teaser page | MEDIUM | MEDIUM | P2 |
| Model display names (not raw IDs) | LOW | LOW | P2 |
| Token cost analytics | LOW | HIGH | P3 |
| Auto-failover between models | MEDIUM | HIGH | P3 |
| Key rotation tooling | LOW | HIGH | P3 |

**Priority key:**
- P1: Must ship in v1.1 — milestone fails without it
- P2: Should ship in v1.1 — quality and differentiation
- P3: Defer to v2+ — valuable but disproportionate cost

---

## Competitor Feature Analysis

| Feature | LiteLLM Proxy | OpenRouter | Open WebUI | RiskMind v1.1 Approach |
|---------|---------------|------------|------------|------------------------|
| Provider onboarding | Config file / API | Web UI | Web UI wizard | 6-step in-app wizard per tenant |
| Auto-fetch models | Yes (via proxy) | Yes (catalog) | Yes (Ollama + OpenAI) | Yes — all 7 providers including Anthropic (now has list endpoint) |
| Per-task routing | Yes (strategy config) | Yes (model shortcuts) | No — chat-focused | Yes — 6 task types with Settings UI + backend routing |
| Model benchmarking | No | Yes (usage stats) | No | Yes — TTFT + latency in wizard Step 5 |
| Embeddings health | No UI | N/A | Partial | Yes — Settings warning banner |
| Multi-tenant configs | Yes | Account-level | No | Yes — per-tenant, encrypted keys |
| Cost tracking | Yes | Yes | No | Deferred to v2 |

---

## Sources

- [Anthropic API — List Models endpoint](https://platform.claude.com/docs/en/api/models/list) — HIGH confidence (official docs, verified)
- [RouteLLM: Learning to Route LLMs with Preference Data](https://arxiv.org/abs/2406.18665) — HIGH confidence (published at ICLR 2025)
- [Multi-Model Routing: Choosing the Best LLM per Task](https://dasroot.net/posts/2026/03/multi-model-routing-llm-selection/) — MEDIUM confidence (current 2026 article)
- [Intelligent LLM Routing: How Multi-Model AI Cuts Costs by 85%](https://www.swfte.com/blog/intelligent-llm-routing-multi-model-ai) — MEDIUM confidence
- [Top 5 LLM Failover Routing Gateways in 2026](https://www.getmaxim.ai/articles/top-5-llm-failover-routing-gateways-in-2026/) — MEDIUM confidence
- [LiteLLM vs OpenRouter Comparison](https://www.truefoundry.com/blog/litellm-vs-openrouter) — MEDIUM confidence
- [Open WebUI Features](https://docs.openwebui.com/features/) — HIGH confidence (official docs)
- [Ollama Integration — Open WebUI Pipelines](https://deepwiki.com/open-webui/pipelines/4.7-ollama-integration) — MEDIUM confidence
- [Multi-LLM Routing Strategies on AWS](https://aws.amazon.com/blogs/machine-learning/multi-llm-routing-strategies-for-generative-ai-applications-on-aws/) — HIGH confidence (official AWS documentation)
- [LLM Latency Benchmark 2026](https://research.aimultiple.com/llm-latency-benchmark/) — MEDIUM confidence
- [Beyond Tokens-per-Second: Balancing Speed, Cost, Quality](https://www.bentoml.com/blog/beyond-tokens-per-second-how-to-balance-speed-cost-and-quality-in-llm-inference) — HIGH confidence (technical depth)
- [OpenClaw: Onboarding configure Primary + Backup LLM](https://github.com/openclaw/openclaw/issues/22357) — MEDIUM confidence (real-world implementation reference)
- RiskMind v1.1 scope document (`.planning/v1.1-scope.md`) — HIGH confidence (authoritative project spec)

---
*Feature research for: LLM Configuration Wizard + Model Routing (RiskMind v1.1)*
*Researched: 2026-03-18*
