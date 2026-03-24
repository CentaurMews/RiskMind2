# Phase 19: Demo-Ready Seed Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 19-demo-ready-seed-data
**Areas discussed:** Vendor data strategy, DPIA template adaptation, Completed assessments, Controls + compliance linkage

---

## Vendor Data Strategy

### Q1: How should real vendors relate to existing fictional vendors?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace fictional vendors | Remove CloudScale/DataGuard/PayFlow/OfficeHub/MarketBridge and replace with real vendor names | |
| Add alongside (Recommended) | Keep fictional vendors as-is, add 5 real ones. Total ~10 vendors | ✓ |
| Real vendors only | Replace all fictional vendors with a larger set of real vendors | |

**User's choice:** Add alongside (Recommended)

### Q2: How much detail should each real vendor have?

| Option | Description | Selected |
|--------|-------------|----------|
| Full profiles (Recommended) | Name, description, tier, category, lifecycle status, contact email, risk score, realistic service descriptions | ✓ |
| Basic records | Name, tier, status, category only | |
| Full + subprocessors | Full profiles plus subprocessor relationships and org dependency entries | |

**User's choice:** Full profiles (Recommended)

### Q3: What lifecycle stages for the real vendors?

| Option | Description | Selected |
|--------|-------------|----------|
| Spread across stages (Recommended) | Microsoft=monitoring, AWS=monitoring, Cloudflare=contracting, Salesforce=due_diligence, SAP=risk_assessment | ✓ |
| All in monitoring | All 5 real vendors fully onboarded and in active monitoring stage | |
| You decide | Claude picks realistic stage assignments | |

**User's choice:** Spread across stages (Recommended)

### Q4: What risk tiers for the real vendors?

| Option | Description | Selected |
|--------|-------------|----------|
| Realistic tiers (Recommended) | Microsoft=critical, AWS=critical, Cloudflare=high, Salesforce=high, SAP=medium | ✓ |
| All critical/high | All 5 are critical or high tier | |
| You decide | Claude assigns tiers | |

**User's choice:** Realistic tiers (Recommended)

### Q5: Should real vendors have risk scores pre-populated?

| Option | Description | Selected |
|--------|-------------|----------|
| Scores for monitored vendors only | Microsoft and AWS get risk scores. Others get null. | ✓ |
| All get scores (Recommended) | All 5 vendors get risk scores | |
| No scores | All new vendors start with null riskScore | |

**User's choice:** Scores for monitored vendors only

---

## DPIA Template Adaptation

### Q1: How should the DPIA questionnaire relate to existing 3 prebuilt templates?

| Option | Description | Selected |
|--------|-------------|----------|
| Add as 4th template (Recommended) | Keep existing 3 templates. Add DPIA as new template. | ✓ |
| Replace Vendor Security | Replace existing Vendor Security template with DPIA version | |
| Add as separate + keep existing | Add DPIA AND keep existing. Users choose quick vs comprehensive. | |

**User's choice:** Add as 4th template (Recommended)

### Q2: How many of the ~80 DPIA questions should be included?

| Option | Description | Selected |
|--------|-------------|----------|
| All 7 sections, full (~80 questions) | Complete adaptation. Sections A-G mapped to assessment sections. | ✓ |
| Core sections only (~50 questions) | Skip Section A and Section F | |
| Trimmed to ~40 questions | Pick most impactful questions from each section | |

**User's choice:** All 7 sections, full (~80 questions)

### Q3: How should question types be mapped?

| Option | Description | Selected |
|--------|-------------|----------|
| Natural mapping (Recommended) | Yes/No → boolean, Short/Long text → text, Multi-select → multiple_choice, etc. | ✓ |
| Simplified mapping | All Yes/No → boolean, everything else → text | |
| You decide | Claude picks type mapping | |

**User's choice:** Natural mapping (Recommended)

### Q4: Should the [Client] placeholder be replaced?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with tenant name | Replace [Client] with 'Acme Corp' | ✓ |
| Keep as [Client] (Recommended) | Keep placeholder for reusability | |
| Replace with generic | Replace with 'the Organization' | |

**User's choice:** Replace with tenant name
**Notes:** User preferred realistic demo feel over template reusability

### Q5: For multi-select questions with '(choices to define)', what options?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude fills realistic options (Recommended) | Generate enterprise-realistic choices for all undefined multi-selects | ✓ |
| Leave as text fields | Convert all undefined multi-selects to text type | |
| Provide my own | User provides specific option lists | |

**User's choice:** Claude fills realistic options (Recommended)

---

## Completed Assessments

### Q1: How many completed assessment instances?

| Option | Description | Selected |
|--------|-------------|----------|
| 3-4 assessments (Recommended) | 2 vendor + 1-2 compliance assessments | ✓ |
| 5-6 assessments | One per real vendor with score + compliance | |
| 1-2 assessments | Minimal | |

**User's choice:** 3-4 assessments (Recommended)

### Q2: What score distribution?

| Option | Description | Selected |
|--------|-------------|----------|
| Varied scores (Recommended) | Microsoft: 82%, AWS: 71%, compliance: 65% | ✓ |
| All passing | All above 70% | |
| You decide | Claude picks scores | |

**User's choice:** Varied scores (Recommended)

### Q3: Full response data or summary-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Full responses (Recommended) | Realistic answers for every question. Fully populated results pages. | ✓ |
| Partial responses | ~50% of questions answered | |
| Summary scores only | Just overall + section scores | |

**User's choice:** Full responses (Recommended)

---

## Controls + Compliance Linkage

### Q1: How many controls?

| Option | Description | Selected |
|--------|-------------|----------|
| 15-20 controls (Recommended) | Key domains: access control, encryption, incident response, etc. | ✓ |
| 30+ controls | Comprehensive ISO 27001 Annex A mapping | |
| 8-10 controls | Minimal common controls | |

**User's choice:** 15-20 controls (Recommended)

### Q2: Should controls be mapped to framework requirements?

| Option | Description | Selected |
|--------|-------------|----------|
| Map to ISO 27001 requirements (Recommended) | Each control links to 1-3 ISO 27001 requirement IDs | ✓ |
| Map to multiple frameworks | Controls mapped to ISO 27001 + SOC 2 + NIST CSF | |
| No mapping yet | Seed controls without requirement mappings | |

**User's choice:** Map to ISO 27001 requirements (Recommended)

### Q3: Control status distribution?

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed statuses (Recommended) | ~10 active, 3-4 planned, 1-2 inactive | ✓ |
| All active | Shows mature security program | |
| You decide | Claude picks distribution | |

**User's choice:** Mixed statuses (Recommended)

### Q4: Control test records?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, 5-8 test records (Recommended) | Pass/fail/partial results with test dates | ✓ |
| No tests | Controls exist but not tested yet | |
| You decide | Claude decides | |

**User's choice:** Yes, 5-8 test records (Recommended)

### Q5: Compliance thresholds per framework?

| Option | Description | Selected |
|--------|-------------|----------|
| Set thresholds (Recommended) | ISO 27001: 80%, SOC 2: 75%, NIST CSF: 70% | ✓ |
| No thresholds | Leave null | |
| You decide | Claude picks thresholds | |

**User's choice:** Set thresholds (Recommended)

---

## Claude's Discretion

- Exact vendor descriptions and service details
- DPIA question weights per section
- Specific assessment response values (within target score ranges)
- Control names, descriptions, and ISO 27001 requirement mappings
- Control test dates and result details
- Control owner assignments

## Deferred Ideas

None — discussion stayed within phase scope
