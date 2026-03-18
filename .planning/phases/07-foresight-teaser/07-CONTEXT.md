# Phase 7: Foresight Teaser - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the bare "Coming Soon" stub on the Foresight page with a polished, confident roadmap preview. 4 feature cards showing planned capabilities. No backend changes — purely UI. This is the final phase of v1.1.

</domain>

<decisions>
## Implementation Decisions

### Tone & Messaging
- Confident roadmap tone — "Here's what's coming" — shows 4 planned capabilities with conviction
- Like an Apple product page — elegant, inspiring, makes the future feel tangible
- Not mysterious or vague — be specific about what each feature does

### Layout
- 4 feature cards in a responsive grid (2×2 on desktop, 1 column on mobile)
- Each card: lucide icon, feature title, 2-line description, subtle visual element
- Clean Apple-like design consistent with the rest of the app (Linear/Vercel aesthetic)
- Page header: "Foresight" title + subtitle about what's coming

### Four Features to Preview

1. **Monte Carlo Simulation** — "Model risk scenarios with statistical confidence. Run thousands of simulations to understand probability distributions of risk outcomes."
2. **OSINT Risk Horizon** — "Enrich your risk landscape with external intelligence. Automated monitoring of threat feeds, regulatory changes, and industry signals."
3. **Agent Intelligence Feed** — "Your autonomous risk agent's findings in one actionable inbox. Approve, dismiss, or escalate AI-detected risks with full transparency."
4. **What-If Scenario Builder** — "Explore hypothetical scenarios interactively. 'What if this vendor fails?' 'What if we lose this control?' See cascading impacts instantly."

### Design Details
- Cards should have subtle gradient or glass-morphism effect — premium feel
- Icons from lucide-react: Dice (Monte Carlo), Globe (OSINT), Brain (Agent), GitBranch (What-If)
- Muted/disabled appearance — clearly "preview" not "live" — but still beautiful
- No interactive elements (no buttons, no CTAs) — just a visual preview

### Claude's Discretion
- Exact gradient/glass effect implementation
- Card hover animations (subtle scale or shadow)
- Subtitle text exact wording
- Responsive breakpoints
- Whether to add a "v2" or "Coming in future release" label

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Foresight Page
- `artifacts/riskmind-app/src/pages/foresight/foresight.tsx` — Current bare stub to replace

### Design Patterns
- `artifacts/riskmind-app/src/components/ui/card.tsx` — shadcn Card component
- `artifacts/riskmind-app/src/pages/dashboard.tsx` — KPI card design for reference (established visual style)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<Card>` component for feature cards
- lucide-react icons (Dice, Globe, Brain, GitBranch or alternatives)
- Tailwind CSS v4 for all styling
- Established monochrome enterprise theme

### Integration Points
- Replace content of `foresight.tsx` — same route, same AppLayout wrapper
- No new routes, no new nav items (Foresight is already in sidebar)

</code_context>

<specifics>
## Specific Ideas

- Should feel like seeing a product roadmap page on a company website — premium, confident, inspiring
- Each card should make you want that feature to exist
- The page should make demo audiences say "wow, that's what's coming next?"

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase

</deferred>

---

*Phase: 07-foresight-teaser*
*Context gathered: 2026-03-18*
