# CrateHQ Codebase Audit Report

**Date:** 2026-03-09
**Auditor:** Claude Opus 4.6
**Scope:** Full codebase — architecture, security, performance, tech debt, dependencies
**Stack:** Next.js 14 / React 18 / Supabase / Tailwind / Anthropic SDK / Vercel

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture & Structure](#2-architecture--structure)
3. [Critical & High Severity Findings](#3-critical--high-severity-findings)
4. [Security Vulnerabilities](#4-security-vulnerabilities)
5. [Bugs & Breaking Issues](#5-bugs--breaking-issues)
6. [Performance Issues](#6-performance-issues)
7. [Dead Code & Tech Debt](#7-dead-code--tech-debt)
8. [Incomplete Features](#8-incomplete-features)
9. [Dependency Health](#9-dependency-health)
10. [Consistency Issues](#10-consistency-issues)
11. [Prioritized Work Order](#11-prioritized-work-order)

---

## 1. Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 11 |
| Medium | 16 |
| Low | 12 |
| **Total** | **42** |

The application is functionally built and deployed but has **significant security gaps** in data isolation and webhook authentication that must be fixed before multi-user production use. The biggest risks are: (1) all authenticated users can read/write all data due to permissive RLS, (2) the Instantly webhook has zero authentication, and (3) the `extractVariables()` regex is broken. Architecture is sound for a Next.js app of this size but needs cleanup of ~45 dead markdown files and several unused dependencies.

---

## 2. Architecture & Structure

### 2.1 Overall Structure — SOUND

```
src/
├── app/
│   ├── (auth)/          # Login/Signup (2 pages)
│   ├── (dashboard)/     # Protected pages (25 pages)
│   │   ├── admin/       # Admin-only section (7 pages)
│   │   └── ...          # Scout-facing pages
│   ├── api/             # ~89 API routes
│   └── test-auth/       # Debug page (should be removed)
├── components/
│   ├── artists/         # 8 components
│   ├── enrichment/      # 1 component
│   ├── inbox/           # 1 component
│   ├── outreach/        # 2 components
│   ├── pipeline/        # 4 components
│   ├── shared/          # 5 components
│   ├── templates/       # 1 component
│   └── ui/              # 30 shadcn/ui components
├── lib/
│   ├── ai/              # SDR reply generation
│   ├── apify/           # Scraping orchestration
│   ├── cleanup/         # Data validation
│   ├── dm/              # Instagram DM auth
│   ├── enrichment/      # Email discovery pipeline (6 files)
│   ├── ghl/             # GoHighLevel integration
│   ├── import/          # CSV import
│   ├── instantly/       # Email campaign client
│   ├── qualification/   # Artist filtering
│   ├── snapshots/       # Metric snapshots
│   ├── supabase/        # DB clients (3 files)
│   ├── templates/       # Email template engine
│   └── valuation/       # Catalog estimator
├── types/               # TypeScript interfaces
dm-agent/                # Python Instagram DM service
scripts/                 # One-off data scripts
```

### 2.2 Architectural Observations

- **Severity: Low** — No error boundaries anywhere in the React tree. A single component crash takes down the whole page.
  - **File:** `src/app/(dashboard)/layout.tsx`
  - **Fix:** Add `error.tsx` files at the layout level per Next.js conventions.

- **Severity: Low** — `next.config.js:5-8` allows images from ANY hostname (`hostname: '**'`). This is an open redirect vector via the Next.js image optimizer and is flagged by `npm audit` as a DoS vector.
  - **Fix:** Whitelist specific hostnames (Spotify CDN, Instagram CDN, etc.).

- **Severity: Low** — Middleware (`src/middleware.ts:55`) explicitly excludes `/api` routes from auth checks. API routes must self-enforce auth.
  - **Status:** All API routes do check auth individually. This is fine but fragile — a new route without auth would be unprotected by default.

---

## 3. Critical & High Severity Findings

### C-1: RLS Policies Are Permissive (All Data Exposed)
- **Severity: CRITICAL**
- **File:** `supabase-schema.sql:218-228`
- **Problem:** All RLS policies use `USING (true) WITH CHECK (true)`. Any authenticated user (admin or scout) can SELECT, INSERT, UPDATE, DELETE any row in `profiles`, `artists`, `deals`, `conversations`, `tags`, `email_templates`, and `enrichment_jobs`. Only `integrations` has a proper `user_id = auth.uid()` policy.
- **Impact:** Scout A can view/edit Scout B's deals and conversations. Any scout can delete all artists.
- **Fix:** Replace permissive policies with role-aware policies:
  ```sql
  -- Example for deals:
  CREATE POLICY "scouts_own_deals" ON deals FOR ALL TO authenticated
    USING (scout_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));
  ```

### C-2: Instantly Webhook Has ZERO Authentication
- **Severity: CRITICAL**
- **File:** `src/app/api/webhooks/instantly/route.ts:15`
- **Problem:** The POST handler accepts requests from anyone. No signature verification, no bearer token, no IP whitelist. An attacker can inject fake replies, fake bounces, or trigger deal stage changes by sending crafted payloads.
- **Impact:** Data integrity compromise — fake conversations stored, deal stages manipulated.
- **Fix:** Implement webhook signature verification or add a shared secret in a query parameter/header that Instantly sends.

### C-3: `extractVariables()` Regex Is Broken
- **Severity: CRITICAL**
- **File:** `src/lib/templates/variables.ts:101`
- **Problem:** The regex `/{{\\s*([a-z_]+)\\s*}}/g` has literal backslashes. In a JS string (not a RegExp constructor), `\\s` matches a literal backslash followed by 's', not whitespace. This means `extractVariables('Hello {{first_name}}')` returns `[]` — it never matches.
- **Impact:** Any feature depending on variable extraction from templates silently fails.
- **Fix:** Change to `/\{\{\s*([a-z_]+)\s*\}\}/g` (note: `replaceVariables()` on line 91 uses `new RegExp()` and works correctly — only `extractVariables` is broken).

### H-1: Deals API Has No User Isolation
- **Severity: HIGH**
- **File:** `src/app/api/deals/route.ts:85-102`
- **Problem:** The GET handler fetches ALL deals without filtering by `scout_id`. Any authenticated user sees every deal. The `scout_id` filter on line 98-100 is optional (only applied if passed as a query param).
- **Impact:** Data exposure across scout accounts.
- **Fix:** Default filter: `query = query.eq('scout_id', user.id)` unless user is admin.

### H-2: Conversations API Has No User Isolation
- **Severity: HIGH**
- **File:** `src/app/api/conversations/route.ts:91-105`
- **Problem:** Thread list query fetches ALL conversations with no user scoping. Any authenticated user can read all message threads.
- **Impact:** Full message history exposed to any scout.
- **Fix:** Filter by `scout_id` on related deals, or implement at the RLS level (see C-1).

### H-3: Conversations Route — Filter String Injection
- **Severity: HIGH**
- **File:** `src/app/api/conversations/route.ts:85, 244`
- **Problem:** `thread_key` value is interpolated directly into a Supabase `.or()` filter string:
  ```typescript
  .or(`sender.eq.${threadKey},metadata->>from_email.eq.${threadKey},metadata->>to_email.eq.${threadKey}`)
  ```
  If `threadKey` contains `,` or PostgREST operators, it can alter the filter logic.
- **Impact:** Filter bypass — attacker could craft a thread_key to match unrelated records.
- **Fix:** Use separate `.eq()` calls or validate that `threadKey` matches an email/UUID format.

### H-4: Missing `maxDuration` on Bulk Operations
- **Severity: HIGH**
- **Files:**
  - `src/app/api/admin/bulk-publish/route.ts` — loops through posts with 3s delays
  - `src/app/api/artists/bulk-enrich/route.ts` — enrichment pipeline per artist
  - `src/app/api/artists/import/route.ts` — bulk insert/update in chunks
  - `src/app/api/enrichment/start-batch/route.ts` — pagination + chunk inserts
  - `src/app/api/outreach/push-leads/route.ts` — external API calls to Instantly
- **Problem:** No `export const maxDuration` means Vercel's default 60s timeout applies. Bulk operations with many items will silently fail mid-execution.
- **Fix:** Add `export const maxDuration = 300` to each file.

### H-5: API Keys Stored Unencrypted in Database
- **Severity: HIGH**
- **File:** `supabase-schema.sql:199` (`integrations.api_key TEXT`)
- **Problem:** Third-party API keys (Instantly, etc.) stored as plaintext in the `integrations` table.
- **Impact:** Database compromise exposes all integration credentials.
- **Fix:** Use Supabase Vault or application-level encryption for stored credentials.

### H-6: DM-Agent Plaintext Credential Storage
- **Severity: HIGH**
- **File:** `dm-agent/config.json`
- **Problem:** Instagram password, session tokens, and proxy credentials stored in plaintext JSON on disk.
- **Impact:** Server compromise = Instagram account takeover.
- **Fix:** Use environment variables or an encrypted vault.

### H-7: No Rate Limiting on Any Endpoint
- **Severity: HIGH**
- **Problem:** Zero rate limiting across all 89 API routes. Webhooks, bulk operations, and public-facing endpoints can all be spammed.
- **Fix:** Add Vercel rate limiting middleware or implement per-user rate limits.

### H-8: `handle_new_user()` Trigger Accepts Role from Signup Metadata
- **Severity: HIGH**
- **File:** `supabase-schema.sql:28-33`
- **Problem:** The trigger reads `raw_user_meta_data->>'role'` and uses it directly. A user could sign up with `{role: 'admin'}` in their metadata and get admin access.
  ```sql
  COALESCE(NEW.raw_user_meta_data->>'role', 'scout')
  ```
- **Impact:** Privilege escalation — any new signup can become admin.
- **Fix:** Hardcode `'scout'` as default and only allow admin role assignment through a separate admin action:
  ```sql
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'scout');
  ```

---

## 4. Security Vulnerabilities

### S-1: Open Image Proxy
- **Severity: Medium**
- **File:** `next.config.js:5-8`
- **Problem:** `hostname: '**'` allows the Next.js image optimizer to fetch from any URL. Combined with the known Next.js DoS advisory (GHSA-9g9p-9gw9-jx7f), this is exploitable.
- **Fix:** Restrict to known CDN hostnames.

### S-2: API Key Visible in Logs
- **Severity: Medium**
- **Files:**
  - `src/app/api/messages/send/route.ts:325` — logs request body containing auth tokens
  - `src/lib/enrichment/apify-fetch.ts` — Apify token in URL query params logged
  - `src/lib/enrichment/youtube-api.ts` — YouTube API key in URL params logged
- **Fix:** Redact tokens in log output. Use `token.slice(0,8) + '***'` pattern.

### S-3: Error Responses Leak Internal Details
- **Severity: Medium**
- **File:** `src/app/api/admin/publish-to-ghl/route.ts:181`
- **Problem:** Returns raw `postJson` from GHL API in error response, which may contain internal configuration.
- **Fix:** Return generic error message; log details server-side only.

### S-4: Debug Route Exposed Without Auth
- **Severity: Medium**
- **File:** `src/app/api/debug/enrichment-test/route.ts`
- **Problem:** No authentication check. Returns enrichment diagnostic data.
- **Fix:** Add admin auth check or remove entirely.

### S-5: Test Auth Page in Production
- **Severity: Medium**
- **File:** `src/app/test-auth/page.tsx`
- **Problem:** Contains login/signup test forms that bypass normal auth flow and log credentials to console.
- **Fix:** Delete this directory entirely.

### S-6: Hunter.io API Key in Query Parameter
- **Severity: Medium**
- **File:** `src/lib/enrichment/hunter.ts:24`
- **Problem:** API key sent as `?api_key=` in URL. Visible in server logs, proxy logs, and browser history.
- **Fix:** Use POST body or Authorization header if Hunter API supports it.

---

## 5. Bugs & Breaking Issues

### B-1: `extractVariables()` Returns Empty Array (see C-3)
- **Severity: CRITICAL**
- **File:** `src/lib/templates/variables.ts:101`
- Already detailed in C-3. The escaped regex never matches template variables.

### B-2: Conversations Schema Mismatch
- **Severity: Medium**
- **Files:**
  - `supabase-schema.sql:148` defines `deal_id UUID NOT NULL` and `body TEXT NOT NULL`
  - `src/app/api/webhooks/instantly/route.ts:131-151` inserts with `message_text` (not `body`) and no `deal_id`
- **Problem:** The webhook inserts conversations without the required `deal_id` field and uses `message_text` instead of `body`. This will either fail (if schema enforced) or indicates a migration was applied that altered the schema from the original.
- **Fix:** Verify actual production schema. If `deal_id` is nullable and column was renamed to `message_text`, update the schema SQL to match reality.

### B-3: String Null Comparison Anti-Pattern
- **Severity: Low**
- **File:** `src/app/api/conversations/route.ts:28, 68`
- **Problem:** Checks `artistId !== 'null' && artistId !== 'undefined'` — these are string comparisons for the literal strings "null" and "undefined", suggesting URL params are sometimes passed as the string `"null"`.
- **Fix:** Validate params properly: `if (artistId && artistId !== 'null')` works but is a smell — fix the client to not send `"null"`.

### B-4: Emails Opened Counter Race Condition
- **Severity: Low**
- **File:** `src/app/api/webhooks/instantly/route.ts:281`
- **Problem:** `emails_opened: (deal.emails_opened || 0) + 1` is a read-then-write race. Two concurrent open events could result in only +1 instead of +2.
- **Fix:** Use a Supabase RPC to atomically increment, similar to `increment_batch_counter`.

---

## 6. Performance Issues

### P-1: Unbounded Queries
- **Severity: Medium**
- **Files:**
  - `src/app/api/conversations/route.ts:92-105` — fetches ALL conversations to group into threads client-side. With thousands of messages this will be slow and memory-intensive.
  - `src/app/api/analytics/dashboard/route.ts:28-29, 75-82` — `select('*')` on deals without limit.
  - `src/app/api/inbox/route.ts:19-39` — no explicit limit on conversation fetch.
- **Fix:** Add `.limit()` clauses; implement server-side pagination for conversations.

### P-2: Missing Database Indexes
- **Severity: Medium**
- **File:** `supabase-schema.sql`
- **Missing indexes:**
  - `deals(artist_id)` — used in 10+ queries for artist-deal lookups
  - `conversations(artist_id)` — used in thread fetching
  - `profiles(role)` — used in every admin auth check
- **Fix:**
  ```sql
  CREATE INDEX idx_deals_artist_id ON deals(artist_id);
  CREATE INDEX idx_conversations_artist_id ON conversations(artist_id);
  CREATE INDEX idx_profiles_role ON profiles(role);
  ```

### P-3: Sequential API Calls in Bulk Operations
- **Severity: Medium**
- **File:** `src/app/(dashboard)/admin/studio/page.tsx:219-269`
- **Problem:** `handleBuildAllPosts` and `handleGenerateAllImages` make sequential fetch calls with fixed 1-2s delays. No retry logic. A single failure doesn't stop the loop but the user doesn't know which items failed.
- **Fix:** Add retry with exponential backoff; track per-item success/failure state.

### P-4: Client-Side Search Filtering
- **Severity: Low**
- **File:** `src/app/api/deals/route.ts:107-113`
- **Problem:** Fetches ALL deals from the database, then filters by artist name in JavaScript. With thousands of deals, this is wasteful.
- **Fix:** Use Supabase's text search or join filtering.

### P-5: No Enrichment Concurrency Control
- **Severity: Medium**
- **File:** `src/lib/enrichment/enrich-and-save.ts`
- **Problem:** No locking mechanism prevents two simultaneous enrichments of the same artist, wasting API credits and potentially causing data conflicts.
- **Fix:** Use optimistic locking (check `enrichment_attempts` before starting) or a distributed lock.

---

## 7. Dead Code & Tech Debt

### D-1: 45 Dead Markdown Files in Root
- **Severity: High**
- **Problem:** The root directory contains 45+ markdown files that are outdated implementation notes, completion certificates, and feature guides. They clutter the project and contain stale information.
- **Files to delete (all root `.md` except `README.md`):**
  - `AI_SDR_FEATURES.md`, `APIFY_FALLBACK_IMPLEMENTATION.md`, `APIFY_INTEGRATION_COMPLETE.md`, `APIFY_INTEGRATION_VERIFIED.md`, `APIFY_URL_DETECTION_FIX.md`, `AUDIT_REPORT.md`, `DASHBOARD_COMPLETE.md`, `DASHBOARD_GUIDE.md`, `DEBUG_ENRICHMENT.md`, `DEPLOY_NOW.md`, `DEVELOPMENT_CHECKLIST.md`, `EMAIL_TEMPLATES_GUIDE.md`, `ENRICHMENT_AUDIT.md`, `ENRICHMENT_DEBUGGING.md`, `ENRICHMENT_GUIDE.md`, `ENRICHMENT_LOGS_COMPLETE.md`, `ENRICHMENT_LOGS_GUIDE.md`, `ENRICHMENT_LOGS_SETUP.md`, `ENRICHMENT_V2.md`, `FEATURES_BUILT.md`, `FINAL_STATUS.md`, `FIX_ENRICHMENT_NOW.md`, `GETTING_STARTED.md`, `INSTANTLY_INTEGRATION.md`, `INSTANTLY_SETUP_COMPLETE.md`, `KNOWN_ISSUES.md`, `MANUAL_DEPLOY.md`, `MOBILE_RESPONSIVE_AUDIT.md`, `OUTREACH_FEATURES.md`, `PIPELINE_FEATURES.md`, `POLISH_COMPLETE.md`, `POLISH_GUIDE.md`, `PROJECT_STATUS.md`, `QUICKSTART.md`, `READY_TO_USE.md`, `SCOUT_MANAGEMENT_COMPLETE.md`, `SCRAPING_DASHBOARD.md`, `SETUP_COMPLETE.md`, `START_HERE.md`, `TEMPLATES_QUICK_START.md`, `TEMPLATES_SETUP_COMPLETE.md`, `TEST_APIFY_NOW.md`, `VERCEL_ENV_SETUP.md`, `VERIFICATION_COMPLETE.md`
- **Keep:** `README.md`, `docs/ARCHITECTURE.md`, `docs/VERCEL-DEP0169.md`
- **Fix:** `rm` all listed files. Move any content worth preserving into `docs/`.

### D-2: Test Files in Root
- **Severity: Medium**
- **Files:** `test-30k.js`, `test-anthropic.js`, `test-ideas.js`
- **Problem:** Ad-hoc test scripts with hardcoded API calls. Not part of any test framework.
- **Fix:** Delete or move to `scripts/` with proper documentation.

### D-3: Unused npm Dependencies (4 packages)
- **Severity: Medium**
- **File:** `package.json`
- **Unused packages:**
  - `@radix-ui/react-popover` (line 20) — not imported anywhere
  - `@radix-ui/react-separator` (line 22) — not imported anywhere
  - `cmdk` (line 33) — not imported anywhere
  - `date-fns` (line 36) — not imported anywhere
- **Fix:** `npm uninstall @radix-ui/react-popover @radix-ui/react-separator cmdk date-fns`

### D-4: 21 Loose SQL Migration Files in Root
- **Severity: Medium**
- **Problem:** Migration files scattered in root with no versioning or tracking of which have been applied.
- **Fix:** Move to `migrations/` directory. Add a README noting which are applied.

### D-5: 259 Console.log Statements in Production Code
- **Severity: Low**
- **Problem:** Heavy console logging throughout `src/`. Top offenders: `pipeline.ts` (35+), `apify-fetch.ts` (25+), `youtube-api.ts` (20+).
- **Fix:** Implement structured logging (e.g., Pino) with log levels. Remove debug logging or gate behind `NODE_ENV`.

### D-6: Duplicate Email Validation Logic
- **Severity: Low**
- **Files:**
  - `src/lib/qualification/email-filter.ts` — `validateEmail()`, `checkEmailQuality()`
  - `src/lib/cleanup/data-cleanup.ts` — `validateEmail()`, `isValidEmailFormat()`
- **Fix:** Consolidate into a single `src/lib/email-validation.ts` utility.

### D-7: `suppress-dep0169.cjs` Monkey-Patches `process.emit()`
- **Severity: Low**
- **File:** `suppress-dep0169.cjs`
- **Problem:** Overrides Node's `process.emit()` to suppress a deprecation warning. This is a band-aid.
- **Fix:** Update the dependency causing DEP0169 or pin a version that doesn't trigger it.

---

## 8. Incomplete Features

### I-1: KanbanBoard Component Likely Unused
- **Severity: Low**
- **File:** `src/components/pipeline/KanbanBoard.tsx`
- **Problem:** `KanbanBoard` is not imported by any page. `DealCard` and `StageColumn` are only used within it. The pipeline page appears to use a different list-based view.
- **Fix:** Either integrate into pipeline page or remove.

### I-2: AI SDR Auto-Send Not Wired Up
- **Severity: Medium**
- **File:** `supabase-schema.sql:17` — `ai_sdr_auto_send BOOLEAN DEFAULT false`
- **Problem:** The `profiles` table has an `ai_sdr_auto_send` flag but the AI SDR module (`src/lib/ai/sdr.ts`) is a pure classification/generation library with no auto-send trigger.
- **Fix:** Either implement the auto-send workflow or remove the flag.

### I-3: Facebook & Remaining Socials Enrichment Skipped
- **Severity: Low**
- **File:** `src/lib/enrichment/pipeline.ts`
- **Problem:** Steps 6 (Facebook) and 7 (remaining socials) are explicitly skipped with comments noting they need login or have anti-scraping measures.
- **Status:** Acknowledged limitation, not a bug. Document in README.

### I-4: Qualification "Review" Status Has No UI
- **Severity: Low**
- **File:** `src/lib/qualification/qualifier.ts:10`
- **Problem:** The qualifier returns `review` status for edge cases (very high value artists, $0 valuation bugs) but there's no admin UI to handle the review queue.
- **Fix:** Add a review queue page or filter in the admin dashboard.

---

## 9. Dependency Health

### 9.1 npm Audit Results

| Severity | Count | Notable |
|----------|-------|---------|
| Critical | 1 | `basic-ftp` path traversal (via `vercel` CLI devDep) |
| High | 10 | `next` DoS (image optimizer), `glob` command injection, `minimatch` ReDoS, `tar` path traversal |
| Moderate | 3 | `ajv` ReDoS |
| Low | 1 | `@tootallnate/once` |
| **Total** | **15** | |

**Key action:** `next` 14.x has 2 known high-severity vulnerabilities. Upgrade to 15.x+ resolves them.

### 9.2 Outdated Dependencies

| Package | Current | Latest | Priority |
|---------|---------|--------|----------|
| `next` | 14.2.35 | 16.1.6 | **High** — security fixes |
| `@anthropic-ai/sdk` | 0.32.1 | 0.78.0 | **Medium** — major API changes |
| `@supabase/ssr` | 0.5.2 | 0.9.0 | **Medium** — breaking changes |
| `react` / `react-dom` | 18.3.1 | 19.2.4 | **Low** — major version, plan carefully |
| `lucide-react` | 0.468.0 | 0.577.0 | **Low** — icon updates |
| `recharts` | 2.15.0 | 3.8.0 | **Low** — major version |
| `eslint-config-next` | 14.2.21 | 16.x | **Low** — tied to Next.js version |

### 9.3 Missing Type Definitions
- **Severity: Medium**
- **File:** `src/types/database.ts`
- **Missing interfaces:** `EnrichmentLog`, `IgAccount`, `ArtistSnapshot`, `EnrichmentQueue`, `ContentPost`, `ContentIdea`
- **Impact:** 69 `any` type annotations across the codebase, primarily in enrichment and webhook code.

---

## 10. Consistency Issues

### CS-1: Inconsistent Error Handling Patterns
- **Severity: Medium**
- Some components show toast notifications on error (dashboard, studio, artists pages).
- Others silently `console.error` (KanbanBoard, GrowthTrend, InboxList).
- **Fix:** Standardize: all user-initiated actions show toast on error.

### CS-2: Mixed `any` vs Typed Responses
- **Severity: Medium**
- API route handlers inconsistently type Supabase responses. Some use `any`, others have proper types.
- Worst offenders: `conversations/route.ts`, `webhooks/instantly/route.ts`, `enrichment/enrich-and-save.ts`.
- **Fix:** Define response types in `src/types/database.ts` and use consistently.

### CS-3: Conversations Schema Drift
- **Severity: Medium**
- The original schema (`supabase-schema.sql`) defines `body TEXT NOT NULL` and `deal_id UUID NOT NULL`.
- Actual code uses `message_text`, nullable `deal_id`, and additional columns (`read`, `sender`, `external_id`, `ig_thread_id`, `metadata`, `channel`).
- **Fix:** Create a canonical up-to-date schema file that matches production.

### CS-4: Inline Styles in Tailwind Project
- **Severity: Low**
- **Files:**
  - `src/components/pipeline/StageColumn.tsx:23` — `style={{ backgroundColor: color }}`
  - `src/components/shared/TagBadge.tsx:13` — dynamic color styling
  - `src/components/artists/BulkEnrichModal.tsx:205` — inline color
- **Fix:** Use CSS variables or dynamic Tailwind classes where possible.

### CS-5: Naming Inconsistency in Supabase Clients
- **Severity: Low**
- `src/lib/supabase/client.ts` exports `createClient` (matches Supabase convention)
- `src/lib/supabase/server.ts` exports `createClient` (same name, different import path)
- `src/lib/supabase/service.ts` exports `createServiceClient` (different convention)
- **Fix:** Rename to `createBrowserClient`, `createServerClient`, `createServiceClient` for clarity.

---

## 11. Prioritized Work Order

### Week 1 — Critical Security (MUST DO)

| # | Finding | File(s) | Effort |
|---|---------|---------|--------|
| 1 | **C-1:** Fix RLS policies — add proper user-scoped policies | `supabase-schema.sql` | 2-3 hrs |
| 2 | **H-8:** Remove role from signup trigger — hardcode 'scout' | `supabase-schema.sql:32` | 10 min |
| 3 | **C-2:** Add auth to Instantly webhook | `src/app/api/webhooks/instantly/route.ts` | 1 hr |
| 4 | **H-1 + H-2:** Add user isolation to deals + conversations APIs | `src/app/api/deals/route.ts`, `conversations/route.ts` | 2 hrs |
| 5 | **H-3:** Fix filter string injection in conversations | `src/app/api/conversations/route.ts:85,244` | 30 min |
| 6 | **C-3:** Fix `extractVariables()` regex | `src/lib/templates/variables.ts:101` | 5 min |
| 7 | **S-5:** Delete test-auth page | `src/app/test-auth/` | 5 min |

### Week 2 — High Priority Fixes

| # | Finding | File(s) | Effort |
|---|---------|---------|--------|
| 8 | **H-4:** Add `maxDuration` to bulk routes | 5 API routes | 30 min |
| 9 | **S-1:** Restrict image hostname wildcard | `next.config.js` | 15 min |
| 10 | **S-4:** Remove or protect debug route | `src/app/api/debug/` | 15 min |
| 11 | **P-2:** Add missing database indexes | SQL migration | 15 min |
| 12 | **B-2:** Reconcile conversations schema with code | Schema + routes | 1 hr |
| 13 | **H-5:** Encrypt API keys in integrations table | Schema + code | 2 hrs |

### Week 3 — Cleanup & Tech Debt

| # | Finding | File(s) | Effort |
|---|---------|---------|--------|
| 14 | **D-1:** Delete 45 dead markdown files | Root directory | 15 min |
| 15 | **D-2:** Delete/move test files | Root directory | 10 min |
| 16 | **D-3:** Remove unused npm dependencies | `package.json` | 5 min |
| 17 | **D-4:** Organize SQL migrations | Root directory | 30 min |
| 18 | **CS-3:** Create canonical schema file | `supabase-schema.sql` | 2 hrs |
| 19 | Missing type definitions | `src/types/database.ts` | 2 hrs |

### Month 1 — Hardening

| # | Finding | Effort |
|---|---------|--------|
| 20 | **H-7:** Implement rate limiting | 4 hrs |
| 21 | Upgrade `next` to 15.x for security patches | 4-8 hrs |
| 22 | Update `@anthropic-ai/sdk` to 0.78.x | 2 hrs |
| 23 | Update `@supabase/ssr` to 0.9.x | 1-2 hrs |
| 24 | Implement structured logging (replace console.log) | 4 hrs |
| 25 | Add error boundaries to dashboard layout | 1 hr |
| 26 | Standardize error handling (toasts everywhere) | 2 hrs |
| 27 | **H-6:** Encrypt dm-agent credentials | 2 hrs |

### Backlog — Nice to Have

| # | Finding | Effort |
|---|---------|--------|
| 28 | Fix race condition on emails_opened counter | 30 min |
| 29 | Server-side pagination for conversations | 4 hrs |
| 30 | Add retry logic to bulk operations | 2 hrs |
| 31 | Client-side search → server-side for deals | 1 hr |
| 32 | Enrichment concurrency control | 2 hrs |
| 33 | Consolidate duplicate email validation | 1 hr |
| 34 | KanbanBoard: integrate or remove | 30 min |
| 35 | AI SDR auto-send: implement or remove flag | 2-4 hrs |

---

*End of audit. Total findings: 42 across 8 categories. Estimated total remediation: ~50-60 hours.*
