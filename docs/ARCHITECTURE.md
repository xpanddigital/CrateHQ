# CrateHQ (Flank) — Technical Architecture & Operations Guide

This document is a detailed breakdown of how the application works: stack, data model, APIs, integrations, background jobs, and hardware-related flows (DM agent, enrichment, Vercel). Use it to train models or troubleshoot deployment and hardware issues.

---

## 1. Project overview

**Product name:** Flank (formerly CrateHQ)  
**Purpose:** CRM and outreach automation for music catalog financing — deal pipeline, artist enrichment, email/Instagram inbox, and a Content Engine for multi-account social content.

**Tech stack:**
- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deployment:** Vercel (serverless + cron)
- **External workers:** Python DM agent (runs on separate VM/hardware for Instagram)

**Repo layout (high level):**
- `src/app` — Next.js routes, layouts, pages
- `src/app/api` — API route handlers (REST)
- `src/components` — React UI (pipeline, inbox, shared, artists, etc.)
- `src/lib` — Shared logic (Supabase clients, GHL, Instantly, DM auth, enrichment, etc.)
- `dm-agent/` — Python service for Instagram DMs (separate process, not on Vercel)
- `supabase-*.sql` — Schema migrations (run manually in Supabase SQL editor)

---

## 2. Authentication and roles

- **Auth:** Supabase Auth (email/password). Login/signup live under `(auth)/login` and `(auth)/signup`; no dedicated auth API — client calls `supabase.auth.signInWithPassword()` etc.
- **Protected APIs:** Server routes use `createClient()` from `@/lib/supabase/server` and `supabase.auth.getUser()` (cookies). Unauthenticated requests return 401.
- **Roles:** Stored in `profiles.role`: `admin` | `scout`.
  - **Admin:** Full access; can use `/admin/*` (identities, studio, calendar, publish, library, knowledge, agents). Admin routes check `profiles.role === 'admin'` and return 403 otherwise.
  - **Scout:** No admin UI or routes; sees pipeline, inbox, artists, templates, outreach, etc.
- **Service role:** Server-side operations that bypass RLS (e.g. webhooks, dm-agent, enrichment queue) use `createServiceClient()` from `@/lib/supabase/service` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## 3. Database (Supabase) — tables and purpose

### 3.1 Core (artists, deals, users)

| Table | Purpose |
|-------|--------|
| **profiles** | One row per `auth.users.id`. Fields: role (admin/scout), commission, AI SDR, Calendly, etc. |
| **artists** | Artist records: name, Spotify/social links, emails, enrichment state, valuation, qualification_status, management_company, booking_agency, etc. |
| **artist_tags** | Many-to-many: artist_id, tag_id. |
| **tags** | Tag name, color, description. |
| **deals** | One per artist+scout: stage, value, commission, Instantly campaign id, etc. |
| **deal_tags** | Many-to-many: deal_id, tag_id. |
| **integrations** | Per-user API keys (e.g. Instantly); service, api_key, config. |
| **email_templates** | Email sequence templates. |

### 3.2 Conversations and inbox

| Table | Purpose |
|-------|--------|
| **conversations** | Unified message store. One row per message. Key columns: `artist_id`, `channel` ('instagram' \| 'email'), `direction` ('inbound' \| 'outbound'), `message_text`, `sender`, `ig_account_id`, `ig_thread_id`, `ig_message_id`, `external_id` (Instantly), `scout_id`, `metadata` (JSONB), `read`, `created_at`. Used for both email (synced from Instantly) and Instagram (from dm-agent webhook). |
| **pending_outbound_messages** | Queue for Instagram replies. Columns: `ig_account_id`, `ig_thread_id`, `message_text`, `scout_id`, `artist_id`, `status` ('pending' \| 'sending' \| 'sent' \| 'failed'), `error_message`, `created_at`, `sent_at`. The DM agent polls these and sends via Instagram; then confirms via API. |

### 3.3 Instagram DM and agent

| Table | Purpose |
|-------|--------|
| **ig_accounts** | One row per Instagram account. Columns: `id` (TEXT PK), `ig_username`, `webhook_secret` (used to auth dm-agent and webhook), `timezone`, `active_start_hour`, `active_end_hour`, `poll_interval_active_min`, `poll_interval_wind_down_min`, `is_active`, `last_heartbeat`, `status`. After Content Engine migration: `ghl_location_id`, `ghl_social_account_id`, `ghl_api_key` for Go High Level. |
| **agent_heartbeats** | Health log: `ig_account_id`, `status`, `messages_found`, `messages_sent`, `error_detail`, `created_at`. DM agent POSTs here periodically. |

### 3.4 Content engine (admin)

| Table | Purpose |
|-------|--------|
| **knowledge_bases** | Long-form brand/context for AI (name, content, content_type). |
| **account_identities** | Per–IG-account content profile: theme_id, colors, fonts, voice_prompt, caption_style, content_pillars (array), image_styles, image_subjects, posting_times, posting_days, posts_per_day, carousel_ratio, hashtag_pool, etc. Linked to `ig_accounts` via `ig_account_id`. |
| **content_posts** | Generated posts: post_type (carousel/single), status (draft/scheduled/published), title, category, caption, slides/nano_prompt/image_url, scheduled_date, scheduled_time, ghl_post_id, published_at, identity_id, ig_account_id. |
| **content_topics** | Topics for idea dedup: topic_hash, title, ig_account_id. |

### 3.5 Enrichment

| Table | Purpose |
|-------|--------|
| **enrichment_batches** | Batch run metadata: status (queued/processing/completed/paused/cancelled), counts. |
| **enrichment_queue** | Per-artist queue rows: batch_id, artist_id, status, attempts, email_found, etc. |
| **enrichment_logs** | Step-by-step results per run: steps (JSONB), email_found, run_by. |
| **enrichment_jobs** | Legacy single-job tracking (if still used). |

### 3.6 Other

| Table | Purpose |
|-------|--------|
| **outreach_logs** | History of pushes to Instantly: scout, campaign, leads pushed/added/skipped, deals created. |
| **artist_snapshots** | Daily artist metrics for growth charts. |

**Storage bucket:** `content-images` — public; used by `generate-image` API to store Gemini-generated images at `{ig_account_id}/{postId}.png`.

---

## 4. API routes — grouped by domain

### 4.1 Inbox and messages

- **GET /api/inbox** — List conversation threads (grouped by artist/thread) for the authenticated user.
- **GET /api/inbox/count** — Unread count.
- **PATCH /api/inbox/[id]/mark-read** — Mark thread read.
- **GET/POST /api/conversations** — List or create conversation records.
- **POST /api/conversations/sync-instantly** — Sync email conversations from Instantly into `conversations`.
- **POST /api/messages/send** — Send a message. Body: `artist_id` or `thread_key`, `channel` ('email' \| 'instagram'), `message_text`, optional `scout_id`.
  - **Email:** Sends via Instantly API and appends to `conversations` (channel=email, direction=outbound).
  - **Instagram:** Resolves `ig_account_id` and `ig_thread_id` from last inbound IG conversation for that artist/thread; inserts into `conversations` (outbound) and into `pending_outbound_messages` (status=pending). The DM agent later picks these up and sends via Instagram; then calls confirm-sent.

### 4.2 Webhooks (no user auth; validate by secret or signature)

- **POST /api/webhooks/instantly** — Instantly webhook for email events. Creates/updates `conversations` (channel=email), may create/update artists and deals. Uses Instantly payload + optional signature/secret.
- **POST /api/webhooks/instagram-dm** — Inbound Instagram DM from dm-agent. Body includes `ig_account_id`, `thread_id`, `message_id`, `sender_username`, `message_text`, etc. Looks up artist by instagram_handle; inserts into `conversations` (channel=instagram, direction=inbound). Does not use Supabase Auth; caller is dm-agent or FlowChat.

### 4.3 DM agent (auth: Bearer = ig_accounts.webhook_secret)

- **GET /api/dm-agent/pending-replies?ig_account_id=...** — Returns pending rows from `pending_outbound_messages` for that account. Used by the Python agent to get messages to send.
- **POST /api/dm-agent/confirm-sent** — Body: `message_id` (pending row id), `ig_account_id`. Marks row sent, updates `sent_at`; inserts corresponding outbound row into `conversations` so the UI shows the sent message.
- **POST /api/dm-agent/heartbeat** — Body: `ig_account_id`, status, counts. Upserts into `agent_heartbeats` and updates `ig_accounts.last_heartbeat` and `status`.

Auth for all three: `Authorization: Bearer <webhook_secret>` where `webhook_secret` is the value in `ig_accounts` for that `ig_account_id`. Implemented in `@/lib/dm/auth.ts` (`verifyAgentAuth`).

### 4.4 Deals and pipeline

- **GET/POST /api/deals** — List or create deals.
- **GET/PATCH /api/deals/[id]** — Get or update deal.
- **POST /api/deals/[id]/move** — Move deal to another stage.
- **POST /api/deals/[id]/message** — Add message to deal (and conversations).
- **POST /api/deals/bulk-create** — Bulk create deals (e.g. from outreach).

### 4.5 Artists

- **GET/POST /api/artists** — List or create artists.
- **GET/PATCH /api/artists/[id]** — Get or update artist.
- **GET/POST /api/artists/[id]/tags** — Artist tags.
- **POST /api/artists/[id]/enrich** — Trigger single-artist enrichment.
- **POST /api/artists/[id]/qualify** — Set qualification.
- **GET /api/artists/[id]/growth** — Growth/snapshots.
- **POST /api/artists/import** — Import artists (CSV, etc.).
- **GET /api/artists/export** — Export artists.
- **POST /api/artists/from-conversation** — Create artist from conversation and link (e.g. “Create Artist” from inbox).
- **POST /api/artists/bulk-enrich**, **bulk-valuate**, **bulk-tag**, **bulk-delete**, **qualify** — Bulk operations.
- **GET /api/artists/unenriched-ids**, **unenriched-count** — For enrichment UI.
- **POST /api/artists/scrape** — Trigger Apify scrape.
- **POST /api/artists/fix-social-links**, **cleanup** — Maintenance.

### 4.6 Enrichment

- **POST /api/enrichment/start-batch** — Create batch and enqueue artists (writes to `enrichment_batches` and `enrichment_queue`).
- **GET /api/enrichment/process-queue** — **Cron-only.** Auth: `Authorization: Bearer <CRON_SECRET>`. Processes `enrichment_queue` (calls enrichment pipeline), updates queue and batch status, writes `enrichment_logs`. Vercel cron runs this every minute.
- **GET /api/enrichment/batch-status** — Status of a batch.
- **POST /api/enrichment/batch-control** — Pause/cancel batch.
- **GET /api/enrichment/logs** — Enrichment logs.
- **POST /api/enrichment/diagnose** — Diagnose enrichment (e.g. test APIs).

### 4.7 Outreach (Instantly)

- **GET /api/outreach/campaigns** — List Instantly campaigns.
- **GET /api/outreach/campaigns/[id]/analytics** — Campaign analytics.
- **POST /api/outreach/push-leads** — Push leads to Instantly (and create deals / outreach_logs).
- **GET /api/outreach/history** — Outreach history.

### 4.8 Admin — content engine and identities

- **GET/POST/PATCH /api/admin/identities** — CRUD for `account_identities`; GET returns also `available_accounts` (ig_accounts without an identity). POST/PATCH can update `ig_accounts` GHL fields.
- **POST /api/admin/identities/voice** — Generate voice prompt (Anthropic).
- **POST /api/admin/identities/hashtags** — Generate hashtags (Anthropic); reads existing from `account_identities` for exclusion.
- **POST /api/admin/ig-accounts** — Create new row in `ig_accounts` (id, ig_username, webhook_secret); used when “Add Instagram account” on identities page.
- **POST /api/admin/generate-ideas** — Generate content ideas (identity + knowledge_bases + content_topics); Anthropic.
- **POST /api/admin/generate-post** — Generate full post (carousel or single), save to `content_posts`, write to `content_topics`.
- **POST /api/admin/generate-image** — Generate image with Gemini, upload to `content-images`, set `content_posts.image_url`.
- **GET /api/admin/safety-check** — Cross-account checks (time collisions, hashtag/pillar overlap, theme conflicts).
- **GET /api/admin/studio-single-posts**, **studio-stats** — Studio data.
- **GET /api/admin/calendar-data** — Scheduled posts for calendar.
- **PATCH /api/admin/calendar-schedule** — Update post schedule (drag-and-drop).
- **POST /api/admin/auto-schedule** — Auto-assign draft posts to dates/times with jitter and collision handling.
- **GET /api/admin/calendar-export** — Export scheduled posts as CSV.
- **GET /api/admin/export-all-content** — Export all content_posts as CSV.
- **POST /api/admin/publish-to-ghl** — Publish one post to Go High Level (uses `getGHLClient(ig_account_id)` from `@/lib/ghl/client.ts`; credentials from `ig_accounts`).
- **POST /api/admin/bulk-publish** — Multiple posts to GHL (throttled).
- **GET /api/admin/agents** — List ig_accounts with heartbeat stats.
- **PATCH /api/admin/agents** — Toggle `ig_accounts.is_active`.
- **GET /api/admin/agents/logs** — Agent heartbeat logs.

### 4.9 Other APIs

- **Scouts:** GET/POST /api/scouts, GET/PATCH /api/scouts/[id] (admin: create user, password reset).
- **Templates:** GET/POST /api/templates, GET/PATCH/DELETE /api/templates/[id].
- **Tags:** CRUD /api/tags.
- **Integrations:** GET/POST /api/integrations; POST /api/integrations/test-instantly, test-apify, check-apify.
- **Analytics:** GET /api/analytics/dashboard.
- **Scraping:** status, results, import, discover, core-data, genres, rescrape-all (Apify).
- **AI:** generate-reply, generate-followup, classify (Anthropic).

---

## 5. External services and environment variables

| Variable | Purpose |
|----------|---------|
| **NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Supabase client (browser + server). |
| **SUPABASE_SERVICE_ROLE_KEY** | Server-only; webhooks, dm-agent auth, enrichment, messages/send (Instagram path). |
| **ANTHROPIC_API_KEY** | Content ideas/post/voice/hashtags (admin), AI reply/followup/classify, enrichment. Model: claude-sonnet-4-6. |
| **INSTANTLY_API_KEY** | Default Instantly API (send email, sync); per-user keys in `integrations`. |
| **APIFY_TOKEN** | Scraping and enrichment (Apify actors). |
| **GEMINI_API_KEY** | Admin generate-image (Imagen); upload to Supabase Storage `content-images`. |
| **GHL_API_BASE** | Go High Level API base (default https://services.leadconnectorhq.com). Per-account key in `ig_accounts.ghl_api_key`. |
| **CRON_SECRET** | Auth for Vercel cron calling `/api/enrichment/process-queue` (Bearer). |
| **HUNTER_API_KEY**, **APOLLO_API_KEY**, **YOUTUBE_API_KEY**, **PERPLEXITY_API_KEY** | Enrichment pipeline (email finding, research). |
| **NEXT_PUBLIC_BASE_URL** | Optional; used for server-side callbacks (e.g. bulk-publish). |

**Important:** Do not set `NODE_OPTIONS` in Vercel to `--require=./suppress-dep0169.cjs`; it is applied at build time and can cause “Cannot find module” and build failure. DEP0169 is suppressed in-app via `src/instrumentation.ts` where possible.

---

## 6. Key user and system flows

### 6.1 Login

1. User opens `(auth)/login`, submits email/password.
2. Client calls `supabase.auth.signInWithPassword()`.
3. On success, redirect to `/dashboard`. Protected pages and API routes use `getUser()` from server Supabase client (cookies).

### 6.2 Inbox — email

1. Instantly sends webhook → **POST /api/webhooks/instantly** → creates/updates `conversations` (channel=email), may create/update artists and deals.
2. User opens inbox → **GET /api/inbox**, **GET /api/conversations** → threads grouped by artist/thread.
3. User sends reply → **POST /api/messages/send** (channel=email) → Instantly API sends email; row appended to `conversations` (outbound).

### 6.3 Inbox — Instagram

1. **Inbound:** DM agent (Python on VM) receives DM from Instagram, forwards to **POST /api/webhooks/instagram-dm** with `ig_account_id`, `thread_id`, `message_id`, `sender_username`, `message_text`. API finds artist by instagram_handle (or leaves artist_id null), inserts `conversations` (channel=instagram, direction=inbound).
2. **Outbound:** User replies in UI → **POST /api/messages/send** (channel=instagram). API resolves `ig_account_id` and `ig_thread_id` from last inbound for that artist/thread; inserts outbound into `conversations` and inserts **pending_outbound_messages** (status=pending). UI can show message optimistically.
3. **DM agent** (separate hardware): Polls **GET /api/dm-agent/pending-replies?ig_account_id=...** with `Authorization: Bearer <webhook_secret>`, gets pending rows, sends each via Instagram (instagrapi), then **POST /api/dm-agent/confirm-sent** with message id. API marks row sent and inserts outbound into `conversations` so the thread shows the sent message once.

### 6.4 DM agent (hardware / VM)

- **Where it runs:** Separate machine (Linux or Windows), not on Vercel. See `dm-agent/README.md`, `install_linux.sh`, `install_windows.bat`.
- **Config:** `dm-agent/config.json`: `ig_account_id`, `ig_username`, `ig_password`, `proxy`, `cratehq_base_url`, `webhook_secret` (must match `ig_accounts.webhook_secret` for that account), timezone, active hours, poll intervals.
- **Flow:** Loop: (1) Poll Instagram for new DMs; (2) For each new DM, POST to `cratehq_base_url/api/webhooks/instagram-dm`. (3) GET `.../api/dm-agent/pending-replies?ig_account_id=...` with Bearer = webhook_secret. (4) For each pending message, send via Instagram. (5) POST `.../api/dm-agent/confirm-sent` for each. (6) POST `.../api/dm-agent/heartbeat`. Uses lock file if running alongside FlowChat to avoid dual Instagram access.
- **Troubleshooting:** Check `ig_accounts.last_heartbeat` and `agent_heartbeats`; confirm `webhook_secret` and `ig_account_id` match; confirm proxy and Instagram credentials; confirm CrateHQ base URL and that the VM can reach it.

### 6.5 Enrichment queue (Vercel cron)

1. User starts batch from UI → **POST /api/enrichment/start-batch** → creates `enrichment_batches` and `enrichment_queue` rows.
2. **Vercel cron** (every minute) calls **GET /api/enrichment/process-queue** with `Authorization: Bearer <CRON_SECRET>`. Route processes queue items (calls enrichment pipeline), updates queue and batch, writes `enrichment_logs`. Pipeline uses Hunter, Apollo, YouTube, Perplexity, etc., and updates artist records (emails, enrichment state).
3. **Troubleshooting:** Ensure `CRON_SECRET` is set in Vercel and matches the request. Check `enrichment_queue` and `enrichment_batches` status; check `enrichment_logs` and API keys for enrichment services.

### 6.6 Content engine (admin only)

1. **Identities:** Admin adds IG account (if needed) via **POST /api/admin/ig-accounts**, then creates/edits identity on **/admin/identities** (POST/PATCH /api/admin/identities). GHL fields saved to `ig_accounts`.
2. **Ideas:** Select identity, click “Generate 10 Ideas” → **POST /api/admin/generate-ideas** (identity + knowledge_bases + content_topics, Anthropic).
3. **Build post:** Click “Build” on an idea → **POST /api/admin/generate-post** → row in `content_posts` (draft), topic in `content_topics`. Single-image: **POST /api/admin/generate-image** (Gemini → Storage → content_posts.image_url).
4. **Calendar:** **GET /api/admin/calendar-data**; drag-drop → **PATCH /api/admin/calendar-schedule**; “Auto-Schedule” → **POST /api/admin/auto-schedule**.
5. **Publish:** **POST /api/admin/publish-to-ghl** (or bulk) uses `getGHLClient(ig_account_id)`; uploads media and creates post via GHL API. Requires `ig_accounts.ghl_location_id`, `ghl_social_account_id`, `ghl_api_key` set per account.

---

## 7. Background jobs and crons

| What | Where | Schedule / trigger |
|------|--------|---------------------|
| **Enrichment process-queue** | Vercel: **GET /api/enrichment/process-queue** | Cron in `vercel.json`: `* * * * *` (every minute). Must send `Authorization: Bearer <CRON_SECRET>`. |
| **DM agent** | External: `dm-agent/dm_agent.py` on VM | Continuous loop (poll Instagram, fetch pending, send, confirm, heartbeat). Not a cron; long-running process. |

No other in-repo scheduled workers. Scripts under `scripts/` are ad-hoc/CLI.

---

## 8. Important file reference

| Path | Purpose |
|------|--------|
| **src/lib/supabase/server.ts** | Server Supabase client (cookies, auth). |
| **src/lib/supabase/service.ts** | Service-role client (bypass RLS). |
| **src/lib/dm/auth.ts** | `verifyAgentAuth(header, igAccountId)` — validates Bearer against `ig_accounts.webhook_secret`. |
| **src/lib/ghl/client.ts** | `getGHLClient(supabase, accountId)` — reads GHL credentials from `ig_accounts`, returns client config. |
| **src/app/api/webhooks/instagram-dm/route.ts** | Inbound IG message handler; writes to `conversations`. |
| **src/app/api/messages/send/route.ts** | Email (Instantly) or Instagram (queue to pending_outbound_messages + conversation). |
| **src/app/api/dm-agent/pending-replies/route.ts** | Returns pending rows for DM agent. |
| **src/app/api/dm-agent/confirm-sent/route.ts** | Marks message sent, writes outbound to `conversations`. |
| **src/app/api/enrichment/process-queue/route.ts** | Cron handler; processes enrichment_queue. |
| **vercel.json** | Cron: path `/api/enrichment/process-queue`, schedule `* * * * *`. |
| **dm-agent/dm_agent.py** | Instagram poll + CrateHQ API client. |
| **dm-agent/config.json** | Per-VM config (ig_account_id, webhook_secret, base URL, proxy, etc.). |
| **supabase-instagram-dm.sql** | conversations, pending_outbound_messages, ig_accounts, agent_heartbeats. |
| **supabase-content-engine.sql** | knowledge_bases, account_identities, content_posts, content_topics; extends ig_accounts with GHL columns. |

---

## 9. Troubleshooting checklist (hardware / deployment)

- **DM agent not receiving or sending DMs:** Verify `config.json` (cratehq_base_url, ig_account_id, webhook_secret); verify `ig_accounts.webhook_secret` and `ig_accounts.is_active`; check network from VM to CrateHQ; check `agent_heartbeats` and `ig_accounts.last_heartbeat`; check proxy and Instagram login.
- **Pending replies not sent:** Confirm **POST /api/messages/send** for Instagram inserts into `pending_outbound_messages`; confirm dm-agent polls pending-replies and calls confirm-sent; check for errors in agent logs.
- **Build fails (e.g. MODULE_NOT_FOUND):** Do not set `NODE_OPTIONS=--require=./suppress-dep0169.cjs` in Vercel; it runs at build time and can break.
- **Enrichment queue not processing:** Ensure Vercel cron is enabled and `CRON_SECRET` is set; ensure **GET /api/enrichment/process-queue** is called with `Authorization: Bearer <CRON_SECRET>`; check enrichment_queue and enrichment_batches status and enrichment_logs.
- **GHL publish fails:** Ensure `ig_accounts.ghl_location_id`, `ghl_social_account_id`, `ghl_api_key` are set for that account; check `getGHLClient` and publish-to-ghl route logs.
- **Identities or content engine 500:** Ensure Content Engine SQL has been run (account_identities, content_posts, etc.); ensure admin user has `profiles.role = 'admin'`.

---

*Document generated for CrateHQ/Flank architecture and operations. Update this file when adding routes, tables, or integrations.*
