# Phase 13: Compliance Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 13-compliance-flow
**Areas discussed:** Scope boundary, Threshold→findings pipeline, Compliance UI refinements, Assessment-to-compliance linkage, Compliance reporting, Evidence management, Guest contributor access

---

## Scope Boundary Check

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow to gaps only (Recommended) | Focus on missing pieces, skip framework import | |
| Full original scope | Include framework import, custom frameworks, all #79 items | ✓ |
| Minimal — just pipeline + polish | Only findings pipeline + minor fixes | |

**User's choice:** Full original scope

---

## Threshold → Findings Pipeline

### Q1: What happens on breach?
| Option | Selected |
|--------|----------|
| Auto-create finding + alert (Recommended) | |
| Alert only | |
| Finding + alert + risk suggestion | ✓ |

### Q2: Recalculation triggers?
| Option | Selected |
|--------|----------|
| On assessment completion + control test (Recommended) | ✓ |
| On any control change | |
| Scheduled only | |

### Q3: Deduplication?
| Option | Selected |
|--------|----------|
| One active finding per framework (Recommended) | ✓ |
| New finding each time | |
| You decide | |

---

## Compliance UI Refinements

### Q1: Threshold config location?
| Option | Selected |
|--------|----------|
| Framework detail page (Recommended) | ✓ |
| Settings page tab | |
| Both | |

### Q2: Import UI location?
| Option | Selected |
|--------|----------|
| Framework list page + button (Recommended) | ✓ |
| Settings page | |
| You decide | |

### Q3: Import formats?
| Option | Selected |
|--------|----------|
| CSV + JSON (Recommended) | ✓ |
| CSV only | |
| JSON only | |

### Q4: Custom framework creation?
| Option | Selected |
|--------|----------|
| Yes — create from scratch (Recommended) | ✓ |
| Import only | |
| Defer to future | |

### Q5: Control auto-mapping?
| Option | Selected |
|--------|----------|
| AI-powered mapping (Recommended) | ✓ |
| Keyword matching | |
| Manual only | |

---

## Assessment-to-Compliance Linkage

| Option | Selected |
|--------|----------|
| Assessment score maps to control effectiveness (Recommended) | ✓ |
| Assessment triggers manual review | |
| You decide | |

---

## Compliance Reporting

| Option | Selected |
|--------|----------|
| PDF + CSV (Recommended) | ✓ |
| CSV only | |
| Defer exports | |

---

## Evidence Management

| Option | Selected |
|--------|----------|
| URL + file upload (Recommended) | ✓ |
| URL only + expiry tracking | |
| Defer | |

---

## Guest Contributor Access

| Option | Selected |
|--------|----------|
| Defer to v2.1 (Recommended) | ✓ |
| Include in Phase 13 | |
| You decide | |

---

## Claude's Discretion
- Diff preview UI layout
- PDF report template design
- Evidence storage location
- Embedding similarity threshold
- Risk suggestion default severity

## Deferred Ideas
- Guest contributor access → v2.1 (auth changes needed)
- Multi-framework crosswalk engine → future milestone
- Automated evidence collection → future milestone
