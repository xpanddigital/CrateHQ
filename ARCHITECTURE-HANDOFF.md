# CrateHQ Architecture Handoff

> For the architect designing the Playwright DOM-based outbound DM system and multi-step nurture sequence engine.
> Generated: 2026-03-09

---

## 1. Database Schema

All tables live in Supabase (PostgreSQL). RLS is enabled on every table. Service-role clients bypass RLS; anon-key clients are subject to policies.

### Core Tables

#### `profiles`
Linked 1:1 to `auth.users` via trigger `handle_new_user()`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References `auth.users(id)` |
| email | TEXT NOT NULL | |
| full_name | TEXT NOT NULL | |
| role | TEXT | `'admin'` or `'scout'` (default `'scout'`) |
| avatar_url | TEXT | |
| phone | TEXT | |
| calendly_link | TEXT | |
| commission_rate | NUMERIC(5,4) | Default 0.08 |
| ai_sdr_persona | TEXT | Default `'professional'` |
| ai_sdr_auto_send | BOOLEAN | Default false (not yet implemented) |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `artists`
Central entity. Artists are scraped, enriched, then pushed into outreach.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| spotify_url | TEXT | |
| country | TEXT | |
| biography | TEXT | |
| genres | JSONB | Default `'[]'` |
| image_url | TEXT | |
| spotify_monthly_listeners | BIGINT | |
| streams_last_month | BIGINT | |
| streams_daily | BIGINT | |
| track_count | INTEGER | |
| growth_mom | NUMERIC(8,6) | Month-over-month |
| growth_qoq | NUMERIC(8,6) | Quarter-over-quarter |
| growth_yoy | NUMERIC(8,6) | Year-over-year |
| growth_status | TEXT | |
| artist_level | TEXT | |
| instagram_handle | TEXT | **Key field for DM matching** |
| instagram_followers | BIGINT | |
| tiktok_handle | TEXT | |
| twitter_handle | TEXT | |
| website | TEXT | |
| social_links | JSONB | |
| email | TEXT | Primary email |
| email_secondary | TEXT | |
| email_management | TEXT | |
| email_source | TEXT | |
| email_confidence | NUMERIC(3,2) | |
| all_emails_found | JSONB | |
| estimated_offer | INTEGER | |
| estimated_offer_low | INTEGER | Used in cold DM generation |
| estimated_offer_high | INTEGER | Used in cold DM generation |
| is_enriched | BOOLEAN | |
| is_contactable | BOOLEAN | |
| enrichment_attempts | INTEGER | |
| last_enriched_at | TIMESTAMPTZ | |
| source | TEXT | `'manual'`, `'spotify_import'`, etc. |
| source_batch | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `deals`
Pipeline tracking. One deal per artist per scout.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| artist_id | UUID FK → artists | |
| scout_id | UUID FK → profiles | |
| stage | TEXT | Enum: `new`, `enriched`, `outreach_queued`, `contacted`, `replied`, `interested`, `call_scheduled`, `call_completed`, `qualified`, `handed_off`, `in_negotiation`, `contract_sent`, `closed_won`, `closed_lost`, `nurture` |
| stage_changed_at | TIMESTAMPTZ | |
| outreach_channel | TEXT | Default `'email'` |
| emails_sent | INTEGER | |
| emails_opened | INTEGER | Incremented atomically via `increment_emails_opened()` RPC |
| last_outreach_at | TIMESTAMPTZ | |
| last_reply_at | TIMESTAMPTZ | |
| next_followup_at | TIMESTAMPTZ | |
| instantly_campaign_id | TEXT | |
| estimated_deal_value | INTEGER | |
| actual_deal_value | INTEGER | |
| commission_amount | INTEGER | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS**: Scouts see only their own deals. Admins see all.

#### `conversations`
Unified message store for ALL channels (email + Instagram).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| deal_id | UUID FK → deals | Legacy, nullable |
| artist_id | UUID FK → artists | Primary link |
| scout_id | UUID FK → profiles | |
| channel | TEXT | `'email'`, `'instagram'`, `'phone'`, `'note'`, `'system'` |
| direction | TEXT | `'outbound'`, `'inbound'`, `'internal'` |
| subject | TEXT | Email subject |
| body | TEXT | Legacy email body field |
| message_text | TEXT NOT NULL | Primary message content (default `''`) |
| sender | TEXT | Email address or IG username |
| external_id | TEXT | Dedup key (e.g. `instantly_<email>_<ts>`) |
| ig_thread_id | TEXT | Instagram thread identifier |
| ig_account_id | UUID | Which IG account handled this |
| ig_message_id | TEXT | Instagram message ID (unique index) |
| metadata | JSONB | Channel-specific data (subject, campaign_id, from_email, to_email, instantly_uuid, pending_message_id, etc.) |
| is_read / read | BOOLEAN | Both exist (legacy + new) |
| ai_classification | TEXT | |
| ai_confidence | NUMERIC(3,2) | |
| ai_suggested_reply | TEXT | |
| requires_human_review | BOOLEAN | |
| sent_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**Indexes**: `artist_id`, `deal_id`, `external_id`, `ig_thread_id`, unique on `ig_message_id`.

### DM System Tables

#### `ig_accounts`
Instagram account configuration. One row per managed IG account.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID-like string, NOT auto-generated UUID |
| ig_username | TEXT NOT NULL | |
| vm_identifier | TEXT | Which VM runs this account's agent |
| timezone | TEXT | Default `'America/Los_Angeles'` |
| active_start_hour | INT | Default 8 |
| active_end_hour | INT | Default 22 |
| poll_interval_active_min | INT | Default 3 |
| poll_interval_wind_down_min | INT | Default 10 |
| is_active | BOOLEAN | **KILL SWITCH** — set false to halt all DM activity |
| webhook_secret | TEXT NOT NULL | Used for Bearer token auth |
| last_heartbeat | TIMESTAMPTZ | |
| status | TEXT | Default `'offline'` |
| daily_cold_dm_limit | INT | Default 3 (warm-up phase) |
| assigned_scout_id | UUID | Default scout for inbound DMs |
| created_at | TIMESTAMPTZ | |

#### `pending_outbound_messages`
Queue for messages waiting to be sent by the Python DM agent.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| ig_account_id | TEXT NOT NULL | FK to ig_accounts |
| ig_thread_id | TEXT | **Nullable** — cold DMs don't have a thread yet |
| message_text | TEXT NOT NULL | |
| scout_id | UUID | |
| artist_id | UUID FK → artists | |
| status | TEXT | `'pending'`, `'sending'`, `'sent'`, `'failed'` |
| error_message | TEXT | |
| is_approved | BOOLEAN | Default false — admin must approve before dispatch |
| scheduled_for | TIMESTAMPTZ | Default now() |
| target_username | TEXT | For cold DMs — the IG handle to DM |
| outreach_type | TEXT | `'reply'` or `'cold'` |
| created_at | TIMESTAMPTZ | |
| sent_at | TIMESTAMPTZ | |

#### `agent_heartbeats`
Health monitoring log for DM agents.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| ig_account_id | TEXT NOT NULL | |
| status | TEXT NOT NULL | `'ok'`, `'error'`, `'challenge_required'`, `'session_expired'` |
| messages_found | INT | |
| messages_sent | INT | |
| error_detail | TEXT | |
| created_at | TIMESTAMPTZ | |

### Other Tables

| Table | Purpose |
|-------|---------|
| `tags` | Shared tag taxonomy (name, color) |
| `artist_tags` | Junction: artist ↔ tag |
| `deal_tags` | Junction: deal ↔ tag |
| `email_templates` | Reusable email templates with sequence_position |
| `enrichment_jobs` | Per-artist enrichment job tracking |
| `integrations` | Per-user API key storage (Instantly, etc.) |
| `enrichment_logs` | Batch enrichment run logs |
| `enrichment_batches` | Batch enrichment grouping |
| `outreach_logs` | Logs when leads are pushed to Instantly |
| `content_posts` | Content studio posts (scheduled, published) |
| `content_topics` | Content topic ideas |
| `account_identities` | IG account brand identities (voice, pillars, hashtags) |

### Key RPC Functions

| Function | Purpose |
|----------|---------|
| `increment_emails_opened(deal_id UUID)` | Atomic counter increment for email opens |
| `is_admin()` | Returns true if `auth.uid()` has admin role |
| `handle_new_user()` | Trigger: auto-creates profile on signup |

---

## 2. API Route Inventory

### Authentication Patterns

1. **User auth (dashboard routes)**: `createClient()` from `@/lib/supabase/server` → `supabase.auth.getUser()` — uses cookie-based Supabase session
2. **Admin auth**: Same as user auth + checks `profiles.role = 'admin'`
3. **Agent auth (DM agent routes)**: `verifyAgentAuth()` from `@/lib/dm/auth` — validates `Authorization: Bearer <webhook_secret>` against `ig_accounts.webhook_secret`
4. **Webhook auth (Instantly)**: Query param `?secret=<INSTANTLY_WEBHOOK_SECRET>` or `x-webhook-secret` header
5. **Cron auth**: `Authorization: Bearer <CRON_SECRET>` header

### DM Agent Routes (DO NOT MODIFY CONTRACTS)

These are polled by a live Python agent on a remote VM.

#### `GET /api/dm-agent/pending-replies`
- **Auth**: Agent auth (Bearer token)
- **Query**: `?ig_account_id=<id>`
- **Kill switch**: If `ig_accounts.is_active = false`, returns `{ messages: [] }`
- **Response**:
```json
{
  "messages": [
    {
      "id": "uuid",
      "thread_id": "ig_thread_id or null",
      "message_text": "string",
      "target_username": "string or null",
      "outreach_type": "reply | cold"
    }
  ]
}
```
- **Filters**: `status = 'pending'`, `is_approved = true`, `scheduled_for <= now()`

#### `POST /api/dm-agent/confirm-sent`
- **Auth**: Agent auth (derived from pending message's ig_account_id)
- **Body**:
```json
{
  "pending_message_id": "uuid (required)",
  "ig_message_id": "string (optional)",
  "ig_thread_id": "string (optional)"
}
```
- **Action**: Sets `pending_outbound_messages.status = 'sent'`, updates `conversations` record via `metadata->>pending_message_id` match
- **Response**: `{ "confirmed": true, "conversation_id": "uuid" }`

#### `POST /api/dm-agent/heartbeat`
- **Auth**: Agent auth
- **Body**:
```json
{
  "ig_account_id": "string (required)",
  "status": "string (required)",
  "messages_found": "number (optional)",
  "messages_sent": "number (optional)",
  "error_detail": "string (optional)"
}
```
- **Auto-quarantine**: If status is `'error'`, `'challenge_required'`, or `'session_expired'`, sets `ig_accounts.is_active = false` and fires alert webhook
- **Response**: `{ "recorded": true }`

### Webhook Routes (DO NOT MODIFY CONTRACTS)

#### `POST /api/webhooks/instagram-dm`
- **Auth**: Agent auth (Bearer token against ig_account's webhook_secret)
- **Body**:
```json
{
  "ig_account_id": "string (required)",
  "thread_id": "string (required)",
  "sender_username": "string (required)",
  "sender_full_name": "string (optional)",
  "message_text": "string (required)",
  "message_id": "string (required)",
  "timestamp": "string (optional)",
  "item_type": "string (optional, default 'text')"
}
```
- **Action**: Dedup on `ig_message_id`, match sender to artist via `instagram_handle` (case-insensitive), insert conversation, auto-advance deals from `outreach_queued`/`contacted` → `replied`
- **Response**: `{ "received": true, "conversation_id": "uuid", "artist_matched": bool, "artist_name": "string|null" }`

#### `POST /api/webhooks/instantly`
- **Auth**: `?secret=<INSTANTLY_WEBHOOK_SECRET>` query param or `x-webhook-secret` header
- **Rate limited**: 200 req/min per IP
- **Events handled**: `lead_interested`/`reply_received`/`reply`, `email_sent`/`sent`, `email_opened`/`opened`, `email_bounced`/`bounced`/`bounce`
- **Action**: Creates conversation records, matches artists by email, updates deal stages on reply

### Outreach Routes

#### `POST /api/outreach/generate-cold`
- **Auth**: Service client (no user auth — called internally)
- **Body**: `{ "artist_id": "uuid", "ig_account_id": "string", "scout_id": "uuid" }`
- **Rate limit**: Enforces `ig_accounts.daily_cold_dm_limit` (default 3/day)
- **Action**: Fetches artist data, generates personalized cold DM via Claude API, inserts into `pending_outbound_messages` with `is_approved: false`
- **Response**: `{ "message_text": "string", "pending_message_id": "uuid" }`

#### `POST /api/outreach/push-leads`
- **Auth**: User auth
- **Body**: `{ "campaignId": "string", "artistIds": ["uuid", ...] }`
- **Action**: Pushes artists to Instantly campaign, creates deals at `outreach_queued` stage

#### `GET /api/outreach/history`
- **Auth**: User auth
- **Response**: List of outreach_logs

#### `GET/POST /api/outreach/campaigns`
- **Auth**: User auth
- **Action**: Lists/manages Instantly campaigns

### Message Routes

#### `POST /api/messages/send`
- **Auth**: User auth (cookie session)
- **Rate limited**: Standard rate limit
- **Body**: `{ "artist_id?": "uuid", "thread_key?": "string", "channel": "instagram|email", "message_text": "string", "scout_id?": "uuid" }`
- **Instagram flow**: Looks up last inbound conversation for thread context → inserts into `pending_outbound_messages` (for agent pickup) + inserts outbound `conversations` record (for immediate UI display)
- **Email flow**: Resolves Instantly sending account → sends via Instantly API → saves conversation

### Admin Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/admin/ig-accounts` | POST | Admin | Create new IG account (auto-generates webhook_secret) |
| `/api/admin/agents` | GET | Admin | List all IG accounts with agent status |
| `/api/admin/agents/[id]` | GET/PATCH | Admin | Get/update single IG account |
| `/api/admin/agents/logs` | GET | Admin | Get agent heartbeat logs |
| `/api/admin/agents/panic` | POST | Admin | Emergency kill switch (deactivate all accounts) |
| `/api/admin/safety-check` | GET | Admin | Cross-account collision detection (posting times, hashtags, content pillars, themes) |
| `/api/admin/generate-post` | POST | Admin | AI content generation |
| `/api/admin/generate-ideas` | POST | Admin | AI topic idea generation |
| `/api/admin/generate-image` | POST | Admin | AI image generation (Gemini) |
| `/api/admin/identities` | GET/POST | Admin | Manage account identities |
| `/api/admin/identities/voice` | POST | Admin | Generate brand voice via AI |
| `/api/admin/identities/hashtags` | POST | Admin | Generate hashtag pool via AI |
| `/api/admin/publish-to-ghl` | POST | Admin | Publish content to GoHighLevel |
| `/api/admin/bulk-publish` | POST | Admin | Bulk publish content |
| `/api/admin/auto-schedule` | POST | Admin | Auto-schedule content |
| `/api/admin/calendar-data` | GET | Admin | Content calendar data |
| `/api/admin/calendar-schedule` | POST | Admin | Schedule content |
| `/api/admin/calendar-export` | GET | Admin | Export calendar |
| `/api/admin/export-all-content` | GET | Admin | Export all content |
| `/api/admin/studio-single-posts` | GET | Admin | Get single posts |
| `/api/admin/studio-stats` | GET | Admin | Content studio statistics |

### Other Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/artists` | GET/POST | User | List/create artists |
| `/api/artists/[id]` | GET/PATCH/DELETE | User | CRUD single artist |
| `/api/artists/[id]/enrich` | POST | User | Enrich single artist |
| `/api/artists/[id]/growth` | GET | User | Get artist growth data |
| `/api/artists/[id]/qualify` | POST | User | AI-qualify artist |
| `/api/artists/[id]/tags` | PUT | User | Update artist tags |
| `/api/artists/bulk-enrich` | POST | User | Bulk enrichment |
| `/api/artists/bulk-delete` | POST | User | Bulk delete |
| `/api/artists/bulk-tag` | POST | User | Bulk tag |
| `/api/artists/bulk-valuate` | POST | User | Bulk valuation |
| `/api/artists/import` | POST | User | Import artists |
| `/api/artists/scrape` | POST | User | Scrape artist data via Apify |
| `/api/artists/export` | GET | User | Export artists |
| `/api/artists/qualify` | POST | User | Qualify artists |
| `/api/artists/from-conversation` | POST | User | Create artist from conversation |
| `/api/artists/cleanup` | POST | User | Clean up artist data |
| `/api/artists/fix-social-links` | POST | User | Fix social link formatting |
| `/api/artists/unenriched-count` | GET | User | Count unenriched artists |
| `/api/artists/unenriched-ids` | GET | User | Get unenriched artist IDs |
| `/api/deals` | GET/POST | User | List/create deals |
| `/api/deals/[id]` | GET/PATCH | User | Get/update deal |
| `/api/deals/[id]/move` | POST | User | Move deal to new stage |
| `/api/deals/[id]/message` | POST | User | Send message in deal context |
| `/api/deals/bulk-create` | POST | User | Bulk create deals |
| `/api/inbox` | GET | User | List conversations |
| `/api/inbox/count` | GET | User | Unread count |
| `/api/inbox/[id]/mark-read` | POST | User | Mark conversation read |
| `/api/conversations` | GET | User | List conversations |
| `/api/conversations/sync-instantly` | POST | User | Sync with Instantly |
| `/api/templates` | GET/POST | User | List/create email templates |
| `/api/templates/[id]` | GET/PATCH/DELETE | User | CRUD template |
| `/api/tags` | GET/POST | User | List/create tags |
| `/api/scouts` | GET/POST | User | List/create scouts |
| `/api/scouts/[id]` | GET/PATCH | User | Get/update scout |
| `/api/analytics/dashboard` | GET | User | Dashboard metrics |
| `/api/ai/classify` | POST | User | AI classify conversation |
| `/api/ai/generate-reply` | POST | User | AI generate reply |
| `/api/ai/generate-followup` | POST | User | AI generate followup |
| `/api/integrations` | GET/POST | User | Manage integrations |
| `/api/integrations/check-apify` | GET | User | Check Apify config |
| `/api/integrations/test-apify` | POST | User | Test Apify connection |
| `/api/integrations/test-instantly` | POST | User | Test Instantly connection |
| `/api/enrichment/*` | Various | User/Cron | Enrichment pipeline routes |
| `/api/scraping/*` | Various | User | Spotify/Apify scraping routes |
| `/api/debug/enrichment-test` | GET | User | Debug enrichment config |

---

## 3. Authentication Flow

### Dashboard Users (Supabase Auth)
1. User signs up/logs in via `/login` or `/signup`
2. Supabase creates session cookie
3. Middleware (`src/middleware.ts`) refreshes session on every request
4. Protected routes redirect to `/login` if no session
5. Server components use `createClient()` from `@/lib/supabase/server` (cookie-based, respects RLS)
6. Admin routes additionally check `profiles.role = 'admin'`

### DM Agent (Bearer Token)
1. Each `ig_accounts` row has a `webhook_secret` (generated on account creation)
2. Python agent includes `Authorization: Bearer <webhook_secret>` on every request
3. `verifyAgentAuth()` in `src/lib/dm/auth.ts`:
   - Extracts token from `Authorization: Bearer <token>` header
   - Looks up `ig_accounts` by `ig_account_id`
   - Compares `account.webhook_secret === token`
   - Checks `account.is_active === true`
   - Returns `{ valid: true, account }` or `{ valid: false, error: string }`

### Service Client (Bypasses RLS)
- `createServiceClient()` from `@/lib/supabase/service` uses `SUPABASE_SERVICE_ROLE_KEY`
- Used by webhook handlers, cron jobs, and agent-facing routes
- Full database access — no RLS restrictions

---

## 4. Current Outbound DM Flow (End-to-End)

### Cold Outreach Flow

```
1. Admin selects artist in UI
           │
           ▼
2. POST /api/outreach/generate-cold
   ├─ Checks daily_cold_dm_limit on ig_accounts
   ├─ Fetches artist data (name, genres, listeners, offer range)
   ├─ Calls Claude API with prompt to generate personalized cold DM
   └─ Inserts into pending_outbound_messages:
      ├─ outreach_type: 'cold'
      ├─ is_approved: false  ← REQUIRES ADMIN APPROVAL
      ├─ target_username: artist.instagram_handle
      └─ ig_thread_id: null (no thread yet)
           │
           ▼
3. Admin reviews & approves message in UI
   └─ Sets is_approved: true on pending_outbound_messages
           │
           ▼
4. Python DM Agent polls GET /api/dm-agent/pending-replies
   ├─ Kill switch check: ig_accounts.is_active must be true
   ├─ Filters: status='pending', is_approved=true, scheduled_for<=now()
   └─ Returns messages with target_username and outreach_type='cold'
           │
           ▼
5. Agent sends DM via Playwright (browser automation)
   ├─ For cold: navigates to target_username profile and sends new DM
   └─ For reply: opens existing thread_id and sends reply
           │
           ▼
6. POST /api/dm-agent/confirm-sent
   ├─ Updates pending_outbound_messages.status = 'sent'
   ├─ Stores ig_thread_id (for cold DMs, this is the new thread)
   └─ Updates conversations record via metadata->>pending_message_id
           │
           ▼
7. POST /api/dm-agent/heartbeat
   └─ Logs cycle status, messages_found, messages_sent
```

### Reply Flow (Human-initiated via UI)

```
1. Scout types reply in pipeline/inbox UI
           │
           ▼
2. POST /api/messages/send { channel: 'instagram', artist_id, message_text }
   ├─ Looks up last inbound conversation for artist to get ig_thread_id + ig_account_id
   ├─ Inserts into pending_outbound_messages (status: 'pending', is_approved: NOT SET — default false)
   └─ Inserts outbound conversations record (for immediate UI display)
           │
           ▼
3. Same agent pickup flow as steps 4-7 above
```

**Important**: Reply messages from `messages/send` are inserted with `is_approved` defaulting to `false`. They need approval or the approval default needs to be changed for replies to be picked up.

### Email Outreach Flow

```
1. POST /api/outreach/push-leads { campaignId, artistIds }
   ├─ Fetches artists, transforms to Instantly leads
   ├─ Pushes to Instantly campaign via API
   └─ Creates deals at stage 'outreach_queued'
           │
           ▼
2. Instantly sends emails automatically based on campaign sequences
           │
           ▼
3. POST /api/webhooks/instantly (Instantly webhook callbacks)
   ├─ email_sent → creates outbound conversation
   ├─ email_opened → increments deal.emails_opened via RPC
   ├─ reply → creates inbound conversation, advances deal to 'replied'
   └─ bounce → marks artist email as rejected
```

---

## 5. Current Inbound DM Flow (End-to-End)

### Instagram DM Inbound

```
1. Artist sends DM to managed IG account
           │
           ▼
2. Python agent detects new message (Playwright DOM scraping)
           │
           ▼
3. POST /api/webhooks/instagram-dm
   {
     ig_account_id, thread_id, sender_username,
     sender_full_name, message_text, message_id,
     timestamp, item_type
   }
           │
           ▼
4. Dedup check on ig_message_id (unique index)
           │
           ▼
5. Fetch assigned_scout_id from ig_accounts
           │
           ▼
6. Artist matching: artists.instagram_handle ILIKE sender_username
           │
           ▼
7. Insert conversation record:
   ├─ channel: 'instagram'
   ├─ direction: 'inbound'
   ├─ artist_id: matched artist or null
   ├─ scout_id: assigned_scout_id or null
   ├─ ig_account_id, ig_thread_id, ig_message_id
   └─ read: false
           │
           ▼
8. If artist matched AND has deal in ['outreach_queued', 'contacted']:
   └─ Auto-advance deal stage → 'replied'
           │
           ▼
9. Response: { received: true, conversation_id, artist_matched, artist_name }
```

### Email Inbound (via Instantly Webhook)

```
1. Lead replies to Instantly email
           │
           ▼
2. POST /api/webhooks/instantly (event_type: 'lead_interested' or 'reply_received')
           │
           ▼
3. Dedup on external_id (instantly_<email>_<timestamp>)
           │
           ▼
4. Artist matching: artists.email ILIKE sender (also checks email_secondary, email_management)
           │
           ▼
5. Strip quoted reply text
           │
           ▼
6. Insert conversation record (channel: 'email', direction: 'inbound')
           │
           ▼
7. If artist matched AND deal in outreach stage → advance to 'replied'
```

---

## 6. Environment Variables

### Required

| Variable | Purpose | Used By |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-constrained) | Client + Server components |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Service client, webhooks, agent routes |
| `ANTHROPIC_API_KEY` | Claude API key | Cold DM generation, enrichment, AI features |
| `APIFY_TOKEN` | Apify API token | Spotify scraping, artist data fetching |

### Optional / Feature-Specific

| Variable | Purpose | Used By |
|----------|---------|---------|
| `INSTANTLY_API_KEY` | Instantly API key (fallback if not in integrations table) | `messages/send` email flow |
| `INSTANTLY_WEBHOOK_SECRET` | Webhook auth for Instantly callbacks | `webhooks/instantly` |
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256-GCM encryption for stored API keys | `lib/crypto.ts` |
| `ALERT_WEBHOOK_URL` | Slack/webhook URL for critical agent alerts | `dm-agent/heartbeat` |
| `LOG_LEVEL` | Logger level: `debug`, `info`, `warn`, `error` | `lib/logger.ts` |
| `GEMINI_API_KEY` | Google Gemini API key for image generation | `admin/generate-image` |
| `YOUTUBE_API_KEY` | YouTube Data API key | Enrichment pipeline |
| `PERPLEXITY_API_KEY` | Perplexity API key | Enrichment pipeline (research) |
| `HUNTER_API_KEY` | Hunter.io API key | Email finding |
| `APOLLO_API_KEY` | Apollo.io API key | Email finding |
| `CRON_SECRET` | Auth for cron job endpoints | `enrichment/process-queue` |
| `GHL_API_BASE` | GoHighLevel API base URL | `lib/ghl/client.ts` |
| `NEXT_PUBLIC_BASE_URL` | App base URL (for internal fetch calls) | `admin/bulk-publish` |

---

## 7. Recent Schema Migrations

All migration files are in `/migrations/`. Run in Supabase SQL Editor. Listed in approximate chronological order by feature area:

### Instagram DM System
| File | Changes |
|------|---------|
| `supabase-instagram-dm.sql` | Creates `conversations`, `pending_outbound_messages`, `ig_accounts`, `agent_heartbeats` tables. Adds `instagram_handle` to artists. |
| `supabase-cold-dm-update.sql` | Adds `target_username`, `outreach_type` to `pending_outbound_messages`. Makes `ig_thread_id` nullable. |
| `supabase-add-approval-queue.sql` | Adds `is_approved`, `scheduled_for` to `pending_outbound_messages`. |
| `supabase-add-dm-limits.sql` | Adds `daily_cold_dm_limit` to `ig_accounts`. |

### Enrichment System
| File | Changes |
|------|---------|
| `supabase-artist-enrichment-columns.sql` | Adds enrichment-related columns to artists |
| `supabase-enrichment-logs.sql` | Creates enrichment_logs table |
| `supabase-enrichment-detailed-logs.sql` | Enhanced enrichment logging |
| `supabase-enrichment-queue.sql` | Enrichment queue system |
| `supabase-add-error-details.sql` | Adds `error_details` to enrichment_logs |

### Artist & Deals
| File | Changes |
|------|---------|
| `supabase-qualification.sql` | Artist qualification system |
| `supabase-spotify-import-columns.sql` | Spotify import fields |
| `supabase-streams-estimated.sql` | Estimated streams columns |
| `supabase-assign-scouts.sql` | Scout assignment to IG accounts |
| `artist_snapshots_migration.sql` | Artist snapshot tracking |
| `supabase-artist-snapshots.sql` | Artist snapshot table |

### Email & Outreach
| File | Changes |
|------|---------|
| `supabase-outreach-logs.sql` | Creates outreach_logs table |
| `supabase-email-rejection-rules.sql` | Email rejection tracking |
| `supabase-new-rejection-rules.sql` | Updated rejection rules |

### Content Engine
| File | Changes |
|------|---------|
| `supabase-content-engine.sql` | Creates content_posts, content_topics, account_identities tables |

### Infrastructure
| File | Changes |
|------|---------|
| `supabase-fix-rls-policies.sql` | RLS policy fixes |
| `supabase-fix-run-by.sql` | Fix run_by column |
| `add-increment-emails-opened-fn.sql` | Atomic emails_opened increment RPC |

---

## Key Architecture Notes for the New System

1. **Kill Switch**: `ig_accounts.is_active = false` immediately halts all outbound activity for that account. The `pending-replies` endpoint returns empty array. Critical errors auto-quarantine via heartbeat.

2. **Approval Gate**: All cold DMs require `is_approved = true` before the agent picks them up. This is the human-in-the-loop safety mechanism.

3. **Daily Limits**: `ig_accounts.daily_cold_dm_limit` (default 3) enforces warm-up phase for new accounts.

4. **Dedup**: Instagram DMs dedup on `ig_message_id` (unique index). Emails dedup on `external_id` (composite key).

5. **Artist Matching**: Inbound IG DMs match on `artists.instagram_handle` (case-insensitive). Inbound emails match on `artists.email`, `email_secondary`, `email_management` (case-insensitive).

6. **Deal Stage Auto-Advance**: Both IG and email inbound handlers auto-advance deals from `outreach_queued`/`contacted` → `replied`.

7. **Two Supabase Clients**: User-facing routes use `createClient()` (RLS-enforced). Agent/webhook routes use `createServiceClient()` (bypasses RLS).

8. **Conversations Table Duality**: Both `message_text` and `body` fields exist. Webhook-inserted records use `message_text`. Legacy UI records may use `body`. Both `is_read` and `read` columns exist.

9. **Metadata JSONB**: The `conversations.metadata` field is heavily used. Key fields: `pending_message_id` (links to pending_outbound_messages), `subject`, `from_email`, `to_email`, `instantly_uuid`, `campaign_id`.

10. **No Real-Time**: There is no WebSocket/Supabase Realtime subscription for conversations. The UI polls or refreshes manually.
