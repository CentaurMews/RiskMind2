# Requirements: RiskMind v1.1

**Defined:** 2026-03-18
**Core Value:** Intelligent LLM management with per-task routing, audit bug fixes, and demo polish

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### LLM Wizard

- [ ] **LLM-01**: Admin can add a new LLM provider by selecting from a dropdown (OpenAI, Anthropic, Google Gemini, Mistral, Groq, Together AI, Ollama/Private)
- [ ] **LLM-02**: Admin enters API key (and base URL for private providers) and system validates the connection
- [ ] **LLM-03**: System auto-discovers available models from the provider API and displays them for selection
- [ ] **LLM-04**: Admin can select one or more models from the discovered list and save the configuration
- [ ] **LLM-05**: Admin can test connection and run a benchmark (TTFT, total latency, quality heuristic) against any configured model
- [ ] **LLM-06**: System suggests optimal model assignment per task type based on benchmark results

### Model Router

- [ ] **ROUTE-01**: Routing table maps 6 task types (enrichment, triage, treatment, embeddings, agent, general) to specific model configurations
- [ ] **ROUTE-02**: Admin can view and override the routing table in Settings
- [ ] **ROUTE-03**: Each AI operation uses its routed model (not just the tenant default)
- [ ] **ROUTE-04**: Routing falls back to tenant default when no task-specific assignment exists

### Bug Fixes

- [ ] **FIX-01**: Document processing worker extracts real file content (not just filename) or shows clear "coming soon" instead of hallucinated summaries
- [ ] **FIX-02**: Autonomous agent persists local findings (cascade, cluster, predictive) before LLM reasoning call — findings survive LLM errors
- [ ] **FIX-03**: Re-enriching a risk replaces existing AI enrichment section instead of appending duplicate blocks
- [ ] **FIX-04**: Vendor AI question generation returns clear error message on LLM parse failure (not confusing "invalid format" 400)
- [ ] **FIX-05**: Vendor scorecard displays real data — last assessment date and open findings count computed from related tables
- [ ] **FIX-06**: Settings page shows warning when no embeddings provider is configured (semantic search, agent clustering silently degrade)
- [ ] **FIX-07**: Model name validation prevents saving invalid model IDs that don't match provider format

### Foresight Teaser

- [ ] **FORE-01**: Foresight page shows polished "Coming Soon" preview with visual mockups of planned features (Monte Carlo, OSINT, scenario modeling, agent inbox)

## Future Requirements

Deferred to v2. Tracked but not in current roadmap.

### Foresight Full

- **FORE-02**: Monte Carlo simulation for risk scenario modeling
- **FORE-03**: OSINT/external data enrichment for risk horizon forecasting
- **FORE-04**: Agent findings inbox with approve/dismiss workflow
- **FORE-05**: LLM observability dashboard (token usage, cost analytics, model performance)

### Advanced

- **ADV-01**: Cross-framework control mapping
- **ADV-02**: Risk clustering via pgvector similarity
- **ADV-03**: Board-ready PDF report generation
- **ADV-04**: Automatic model failover on provider errors

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic failover routing | Easy to misconfigure, confusing behavior — v2 |
| LLM-as-judge quality scoring | Meta-call complexity, not needed for wizard benchmark |
| Provider-specific fine-tuning UI | Out of scope for config wizard |
| Cost tracking / billing | Deferred to LLM observability dashboard (v2) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LLM-01 | Phase 5 | Pending |
| LLM-02 | Phase 5 | Pending |
| LLM-03 | Phase 5 | Pending |
| LLM-04 | Phase 5 | Pending |
| LLM-05 | Phase 5 | Pending |
| LLM-06 | Phase 5 | Pending |
| ROUTE-01 | Phase 5 | Pending |
| ROUTE-02 | Phase 5 | Pending |
| ROUTE-03 | Phase 5 | Pending |
| ROUTE-04 | Phase 5 | Pending |
| FIX-01 | Phase 6 | Pending |
| FIX-02 | Phase 5 | Pending |
| FIX-03 | Phase 6 | Pending |
| FIX-04 | Phase 6 | Pending |
| FIX-05 | Phase 6 | Pending |
| FIX-06 | Phase 6 | Pending |
| FIX-07 | Phase 6 | Pending |
| FORE-01 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — traceability filled after roadmap creation*
