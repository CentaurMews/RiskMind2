# Phase 14: Foresight v2 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-26
**Phase:** 14-foresight-v2
**Areas discussed:** Monte Carlo engine, Simulation UX flow, OSINT calibration, Dashboard ALE widget

---

## Monte Carlo Engine

### Q1: FAIR model granularity?
| Option | Selected |
|--------|----------|
| Standard 4-input FAIR (Recommended) | ✓ |
| Full FAIR decomposition | |
| Simplified 2-input | |

### Q2: Results storage?
| Option | Selected |
|--------|----------|
| Percentiles + histogram bins (Recommended) | ✓ |
| Full raw samples | |

### Q3: Worker Threads threshold?
| Option | Selected |
|--------|----------|
| 50k+ uses Worker Thread (Recommended) | ✓ |
| Always inline | |
| Always Worker Thread | |

---

## Simulation UX Flow

### Q1: Page structure?
| Option | Selected |
|--------|----------|
| Tab-based: Scenarios/Simulations/Calibration (Recommended) | ✓ |
| Single page with sections | |
| Multi-page | |

### Q2: Scenario comparison?
| Option | Selected |
|--------|----------|
| Overlay on same chart (Recommended) | ✓ |
| Split screen | |

### Q3: Chart library?
| Option | Selected |
|--------|----------|
| ECharts (Recommended) | ✓ |
| Recharts | |

### Q4: Async status UX?
| Option | Selected |
|--------|----------|
| Inline progress with auto-poll (Recommended) | ✓ |
| Toast notification | |

### Q5: FAIR input form?
| Option | Selected |
|--------|----------|
| Min/Mode/Max sliders (Recommended) | ✓ |
| Low/High with confidence | |

### Q6: Scenario cloning?
| Option | Selected |
|--------|----------|
| Parameters only (Recommended) | ✓ |
| Parameters + results | |

---

## OSINT Calibration

### Q1: OSINT-to-FAIR mapping?
| Option | Selected |
|--------|----------|
| Statistical aggregation + async LLM enhancement | ✓ |
**Notes:** User requested hybrid: statistical base for immediate results, LLM enhancement arrives asynchronously to enrich suggestions.

### Q2: Calibration scope?
| Option | Selected |
|--------|----------|
| All tenant signals | ✓ |
| Risk-linked signals only (Recommended) | |

---

## Dashboard ALE Widget

### Q1: Placement?
| Option | Selected |
|--------|----------|
| New KPI card in existing strip (Recommended) | ✓ |
| Separate section below heatmap | |

### Q2: Empty state?
| Option | Selected |
|--------|----------|
| Card with CTA (Recommended) | ✓ |
| Hide card entirely | |

---

## Claude's Discretion
- PRNG implementation, histogram bin count, confidence scoring
- Slider component choice, poll interval, distribution tooltip design

## Deferred Ideas
- Correlation matrix → Phase 14.2
- What-if scenario builder → future milestone
- Agent intelligence feed → already exists separately
