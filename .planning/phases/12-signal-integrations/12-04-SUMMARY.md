---
phase: 12-signal-integrations
plan: "04"
subsystem: signal-adapters
tags: [email, imap, imapflow, mailparser, llm-extraction, prompt-injection-safety, adapters]
dependency_graph:
  requires: [12-01]
  provides: [SGNL-05]
  affects: [signal-feed-poller, adapters-registry]
tech_stack:
  added: []
  patterns: [imapflow-imap-client, mailparser-mime-parsing, llm-field-extraction, user-content-prompt-injection-guard]
key_files:
  created:
    - artifacts/api-server/src/adapters/email.ts
  modified:
    - artifacts/api-server/src/adapters/index.ts
    - artifacts/api-server/src/adapters/types.ts
    - artifacts/api-server/src/lib/signal-feed-poller.ts
decisions:
  - "EmailConfig extended with optional tenantId field (not stored in encryptedConfig) — injected at poll time by signal-feed-poller so complete() can route LLM calls per-tenant"
  - "Graceful LLM fallback: if complete() throws or returns unparseable JSON, signal still created with subject as title and info severity — adapter never silently drops emails"
  - "Content hash uses JSON.stringify({messageId}) not email body — message-id is globally unique and stable across polls, giving reliable deduplication"
metrics:
  duration: 100s
  completed_date: "2026-03-23"
  tasks_completed: 1
  files_changed: 4
---

# Phase 12 Plan 04: Email Adapter — IMAP Signal Ingestion Summary

IMAP email adapter using imapflow + mailparser with LLM field extraction, prompt injection safety via `<user_content>` tags, deduplication by message-id, and per-tenant LLM routing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement IMAP email adapter with LLM extraction and prompt injection safety | ada5416 | email.ts (created), index.ts, types.ts, signal-feed-poller.ts |

## What Was Built

**`artifacts/api-server/src/adapters/email.ts`** — Full `SignalFeedAdapter` implementation:

- `createImapClient(config)` — builds `ImapFlow` client from EmailConfig credentials
- `poll(config, since)` — connects to IMAP, searches for messages since date, limits to 50 most recent, parses MIME with `simpleParser`, extracts fields via LLM, returns `RawSignal[]`
- `testConnection(config)` — IMAP NOOP check with mailbox message count
- LLM extraction system prompt wraps email body in `<user_content>` tags with explicit instruction to ignore injected commands
- Extracts: title, severity (critical/high/medium/low/info), entities (CVE IDs, domains, IPs, vendors), summary
- try/finally guarantees `client.logout()` always called

**Safety properties (D-09, D-10, Pitfall 4):**
- `parsed.text` only — HTML field never accessed, mailparser strips HTML
- Attachments completely ignored — `parsed.attachments` never referenced
- Body truncated to 4000 chars before LLM prompt
- `<user_content>` tag delimiters in system prompt prevent prompt injection
- LLM result used for metadata enrichment only — signal status always starts as `pending`

**Deduplication:**
- `externalId` = `messageId` (IMAP Message-ID header, globally unique per RFC 5322)
- `contentHash` = SHA256 of `JSON.stringify({ messageId })` — stable across re-polls
- `onConflictDoNothing()` in signal-feed-poller handles duplicate suppression at DB level

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] tenantId injection for LLM calls**
- **Found during:** Task 1
- **Issue:** `complete()` in llm-service.ts requires `tenantId` as first argument, but `SignalFeedAdapter.poll()` interface only receives `(config, since)` — no tenantId parameter. Plan's referenced `complete(prompt, options?)` signature did not match actual implementation.
- **Fix:** Extended `EmailConfig` interface with optional `tenantId?: string` field (with doc comment noting it is injected at poll time, not stored in encryptedConfig). Added tenantId injection block in `signal-feed-poller.ts` `pollSingleConfig()` function. Graceful fallback applied when tenantId is absent.
- **Files modified:** `adapters/types.ts`, `lib/signal-feed-poller.ts`
- **Commit:** ada5416

**2. [Rule 1 - Bug] Comment strings triggered acceptance criteria grep failures**
- **Found during:** Task 1 verification
- **Issue:** Comments `// D-09: plain text only — never use parsed.html` and `// D-10: attachments completely ignored (parsed.attachments not processed)` caused `grep -q "parsed.html"` and `grep -q "parsed.attachments"` to report false positives during acceptance check.
- **Fix:** Rewrote comments to document the constraint without containing the forbidden string patterns.
- **Files modified:** `adapters/email.ts`
- **Commit:** ada5416

## Self-Check: PASSED

- email.ts: FOUND
- index.ts: FOUND
- ada5416: FOUND in git log
