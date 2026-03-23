# Phase 12: Signal Integrations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-23
**Phase:** 12-signal-integrations
**Areas discussed:** Settings UI for credentials, Polling & scheduling, Signal display enhancements, Email ingestion safety

---

## Settings UI — Config Style

| Option | Description | Selected |
|--------|-------------|----------|
| Integrations tab | Each source as a card with expand, status, Test Connection | ✓ |
| Per-source sub-pages | Separate pages per source | |
| Single form | One long form with sections | |

## Settings UI — Sentinel OAuth2

| Option | Description | Selected |
|--------|-------------|----------|
| Guided fields | Three fields + helper text + docs link + Test Connection | ✓ |
| Step-by-step wizard | Mini-wizard within Sentinel card | |
| Raw JSON config | JSON editor for Azure credentials | |

## Polling — Trigger Method

| Option | Description | Selected |
|--------|-------------|----------|
| Scheduled + manual | node-cron defaults + Sync Now button | ✓ |
| Manual only | Admin clicks each time | |
| Job queue recurring | Delayed re-enqueue pattern | |

## Signal Display — Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Source badge + metadata card | Icon badge on list, Source Details card on detail | ✓ |
| Inline in content | Metadata in signal text | |
| Expandable row | List rows expand for metadata | |

## Email Safety — Body Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Text-only + LLM extract | Strip HTML, LLM extracts entities, attachments ignored | ✓ |
| Full HTML parse | Parse HTML + links + images | |
| Subject-only | Only parse subject line | |

## Claude's Discretion

- node-cron schedule syntax, NVD pagination, Shodan query construction, MISP filtering
- Adapter pattern structure, rate limiting approach, IMAP IDLE vs polling

## Deferred Ideas

None.
