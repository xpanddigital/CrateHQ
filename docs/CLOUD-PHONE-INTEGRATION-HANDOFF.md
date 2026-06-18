# Praecora — Cloud Phone Integration

**Handoff document. Self-contained.**
A fresh Claude session can implement this end-to-end from just this file.

---

## 0. How to use this doc (instruction for the new session)

You are picking up Praecora — a multi-tenant SaaS for music-catalog-financing scouts.
A prior session built the audit, the multi-tenant refactor, the Stripe billing pipeline,
the AI pipeline, the alias generator, the token-usage dashboard, and shipped 12+
migrations to the live Supabase DB. **All of that is done — do not redo any of it.**

The remaining piece is **cloud phone integration**. This doc specifies what to build,
why each decision was made, what files already exist that you must respect, and what
questions you may need to ask the user before implementing.

Read sections 1–4 first to load context. Sections 5+ are the build itself.

---

## 1. Business context (what Praecora is + who pays)

Praecora is a managed outreach platform for **independent music-catalog-financing
scouts** ($1,000–$2,800/mo recurring, $397–$1,597 one-time onboarding). Scouts use
Praecora to run personalized Instagram + email outreach to indie artists at volume,
with replies routed into a unified inbox and a deal pipeline.

Each paying scout gets a **dedicated set of cloud-phone-hosted Instagram Business
accounts** ("aliases"), each on its own cloud phone, anchored to a single SIM-based
IP. A trained operator (in the default tier, our managed VA; in the Self-Operated
tier, the customer's own team) sends the first-touch cold DM manually on the cloud
phone, while reply traffic routes back to Praecora's inbox via GHL's official
business-messaging API. This architecture is marketed as **The 13-Point Sentinel
Protocol™** — see `WEBSITE_BRIEF.md` and the homepage / pricing-card copy.

**The pending customer that drove this build:** a scout agency with 4 sales agents
who can each operate 3 Instagram accounts. Total: **12 cloud phones across 4
operators**, on the **Self-Operated tier** (~$2,999/mo, $1,997 onboarding).

---

## 2. The architecture decision: GeeLark, with provider-agnostic abstraction

After research (see "## 11 Provider research" below), the choice for the first
production deployment is **GeeLark**:

- $29.90/device/mo flat (predictable unit cost)
- Real Android device fingerprints
- Public, documented REST API for `createPhone`, `getPhoneStatus`, etc.
- Unlimited team seats with role-based permissions in all paid tiers
- Industry-recommended for Instagram multi-account work
- Three+ years of independent reviews and a known operational track record

We build the **integration behind a provider-agnostic interface** so we can swap
or add BitBrowser/Multilogin/aliremote later without UI changes.

### UX honesty about logins

There is **no true white-label** at our scale. When an operator clicks "Open phone
for @bandname" in Praecora, we open GeeLark in a new tab. The operator logs into
GeeLark **once per browser session** with a sub-user credential we issued them;
every subsequent click drops them straight at the right phone profile (because the
URL is a deep-link to the profile, and they're already authenticated). It feels
like a deep-link into a tool, not a separate product. We do **not** try to iframe
or proxy GeeLark — it's fragile and breaks unpredictably.

---

## 3. What's already built (DO NOT REDO)

These items exist in the codebase and database. Build *on top of* them, do not
recreate.

### Database

- `accounts` table — multi-tenant boundary
- `account_members(account_id, user_id, role)` — many-to-many users-per-account
- `ig_accounts` table — Instagram accounts owned by each tenant
  - **Already includes:** `id, ig_username, account_id, assigned_scout_id, webhook_secret, daily_cold_dm_limit, ghl_*` columns, `is_active`
- `account_identities` table — brand identities (each linked to an ig_account)
  - **Already includes (from alias-generator migration):**
    `ig_status, warming_until, cloud_phone_id (text), fb_page_id`
  - `cloud_phone_id` is currently NULL — this is what we now wire up
- `scouts` table — billing record, with `fb_status, warming_until, fb_persona_json,
  fb_profile_photo_url, subscription_tier`
- `ai_usage` table — per-tenant AI spend log
- RLS policies enforce account isolation on every table

### Application code

- `src/lib/auth/account.ts` — `resolveAccountIdForUser()`, `resolveAccountIdForIgAccount()`
- `src/lib/supabase/{client,server,service}.ts` — three Supabase client variants
- `src/lib/crypto.ts` — `encrypt()`, `decrypt()`, `isEncrypted()` for credential storage
- `src/lib/ai/usage.ts` — `recordAiUsage()`, `recordAnthropicUsage()`
- `src/lib/identity/generate-brand.ts` and `generate-fb-persona.ts` — Claude-driven
  brand identity + FB persona generation
- `src/app/api/admin/aliases/generate/route.ts` — Phase A/B orchestrator for new
  aliases. **Currently returns a checklist with "provision a cloud phone" as a
  manual step. You will replace that step with a GeeLark API call.**
- `src/app/(dashboard)/admin/aliases/generate/page.tsx` — alias-generator wizard
- `src/components/shared/Sidebar.tsx` — navigation. Add new operator-facing route here.

### Migrations directory

All schema lives in `migrations/`. Naming convention: `YYYY-MM-DD-<short-name>.sql`.
Each migration is idempotent (uses `IF NOT EXISTS`, etc.) and run by hand via
`supabase db query --linked -f migrations/<file>.sql`. **Never run an old migration
file with the same date prefix twice unless it's been made idempotent.**

### Env vars (already wired)

`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `APIFY_TOKEN`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `GHL_WEBHOOK_SECRET`, `INSTANTLY_API_KEY`,
`INSTANTLY_WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`,
`ALERT_EMAIL_TO`, `SUPABASE_SERVICE_ROLE_KEY`, `CREDENTIALS_ENCRYPTION_KEY`.

You will add: `GEELARK_API_KEY`, `GEELARK_API_BASE` (default to
`https://api.geelark.com`).

---

## 4. The build — high-level overview

Five components, in dependency order:

1. **Schema migration** — add cloud-phone provisioning columns + a session-log
   table.
2. **`lib/cloud-phones/`** — provider-agnostic interface + GeeLark concrete impl.
3. **API routes** — admin provisioning + operator deep-link launcher.
4. **UI pages** — admin bulk-provision wizard + operator "My Phones" page.
5. **Alias-generator integration** — auto-provision a phone during Phase B
   instead of telling the operator to do it manually.

Estimated full build: **1–2 focused days** by a single developer.

---

## 5. Schema migration

Create `migrations/2026-05-23-cloud-phone-integration.sql` with the following:

```sql
-- Cloud phone provisioning + operator assignment + audit log.
-- Run after the multi-tenant migrations.

-- ── 1. Columns on ig_accounts: provider + provider-side identifiers
ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS cloud_phone_provider TEXT
    CHECK (cloud_phone_provider IN ('geelark','bitbrowser','aliremote','multilogin','manual')),
  ADD COLUMN IF NOT EXISTS cloud_phone_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS cloud_phone_proxy_anchor TEXT,
  ADD COLUMN IF NOT EXISTS operator_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ig_accounts_operator ON public.ig_accounts(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_ig_accounts_provider_profile ON public.ig_accounts(cloud_phone_provider, cloud_phone_profile_id);

-- ── 2. Encrypted per-operator vendor credentials, stored on accounts (one tenant
-- has one set of operator → vendor-sub-user-credential mappings).
-- The shape of cloud_phone_subusers is:
--   { "operator_user_id_a": { "subuser_username": "...", "subuser_password_enc": "...", "subuser_id": "..." },
--     "operator_user_id_b": { ... } }
-- Encrypt the password client-side (lib/crypto.ts encrypt()) before storing.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cloud_phone_provider TEXT,
  ADD COLUMN IF NOT EXISTS cloud_phone_subusers JSONB DEFAULT '{}';

-- ── 3. Session log table — every time an operator opens a phone, log it for
-- audit / SLA / anchor-violation detection.
CREATE TABLE IF NOT EXISTS public.cloud_phone_sessions (
    id BIGSERIAL PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    ig_account_id TEXT NOT NULL REFERENCES public.ig_accounts(id) ON DELETE CASCADE,
    operator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    operator_ip TEXT,
    user_agent TEXT,
    deep_link_url_hash TEXT,   -- sha256 of the deep-link URL (don't store the URL — it may contain auth tokens)
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cps_account_time ON public.cloud_phone_sessions(account_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cps_operator_time ON public.cloud_phone_sessions(operator_user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cps_ig_time ON public.cloud_phone_sessions(ig_account_id, opened_at DESC);

ALTER TABLE public.cloud_phone_sessions ENABLE ROW LEVEL SECURITY;

-- Account members can read their own session log. Admins read everything.
CREATE POLICY "cloud_phone_sessions_select" ON public.cloud_phone_sessions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- Inserts only via service role (the API route logs the session on behalf of the operator).
```

Deploy with:
```bash
cd /Users/joelhouse/Projects/products/crate-hq/app/CrateHQ
supabase db query --linked --output json -f migrations/2026-05-23-cloud-phone-integration.sql
```

---

## 6. Library: `src/lib/cloud-phones/`

### 6.1 Provider interface

Create `src/lib/cloud-phones/types.ts`:

```typescript
export type CloudPhoneProvider = 'geelark' | 'bitbrowser' | 'aliremote' | 'multilogin' | 'manual'

export interface ProvisionPhoneOpts {
  /** Human-readable label, e.g. 'alias-brooklyn-1' */
  label: string
  /** Optional proxy config — sets the IP anchor for this phone */
  proxy?: { type: 'sock5' | 'http'; host: string; port: number; username?: string; password?: string }
  /** Provider-specific extras */
  metadata?: Record<string, unknown>
}

export interface ProvisionedPhone {
  provider: CloudPhoneProvider
  profileId: string
  /** Provider-side URL to manage / view this phone */
  managementUrl: string
}

export interface SubUserCredentials {
  username: string
  password: string  // plaintext on creation; encrypt before persisting
  subUserId: string
}

export interface CloudPhoneClient {
  provider: CloudPhoneProvider
  provisionPhone(opts: ProvisionPhoneOpts): Promise<ProvisionedPhone>
  shutdownPhone(profileId: string): Promise<void>
  /** Returns the URL the operator should open in a new tab. May include short-lived auth params. */
  getPhoneDeepLink(profileId: string, subUserCreds?: SubUserCredentials): Promise<string>
  /** Create a vendor sub-user that can be scoped to a subset of phones */
  createSubUser(opts: { displayName: string }): Promise<SubUserCredentials>
  /** Assign a phone to a vendor sub-user so they can see it in their dashboard */
  assignPhoneToSubUser(profileId: string, subUserId: string): Promise<void>
  /** Health check */
  getPhoneStatus(profileId: string): Promise<{ status: 'running' | 'suspended' | 'shutdown' | 'unknown'; lastSeen?: Date }>
}
```

### 6.2 GeeLark implementation

Create `src/lib/cloud-phones/geelark.ts`. Implement the `CloudPhoneClient`
interface against the GeeLark REST API.

**Key GeeLark API endpoints** (confirm against
https://www.geelark.com/features/api/ before implementation — the new session
should fetch this and read it):

- `POST /open/v1/phone/add` — create profile
- `POST /open/v1/phone/start` — power on
- `POST /open/v1/phone/stop` — shut down
- `POST /open/v1/phone/list` — query existing
- `POST /open/v1/team/subuser/add` — create sub-user (verify exact path)
- `POST /open/v1/team/subuser/assignProfile` — scope a phone to a sub-user
- Deep-link URL pattern: `https://app.geelark.com/profile/{profileId}` (verify)

**Auth:** Bearer `GEELARK_API_KEY` in `Authorization` header.

**Open questions for the new session to resolve by reading GeeLark docs or
asking sales:**
1. Does GeeLark's API support creating sub-users programmatically, or do
   sub-users need to be created manually in their dashboard?
2. What's the deep-link URL structure for opening a specific phone profile?
3. Can a sub-user be auto-logged-in via a token in the URL, or do they always
   see a login screen first?

If sub-user creation isn't API-accessible, fall back to: **admin creates each
operator's sub-user manually once in the GeeLark dashboard, stores the username
in `accounts.cloud_phone_subusers`, and the operator logs in manually the first
time per browser session.** That's acceptable for the v1 build.

### 6.3 Factory

Create `src/lib/cloud-phones/index.ts`:

```typescript
import type { CloudPhoneClient, CloudPhoneProvider } from './types'
import { GeeLarkClient } from './geelark'

export function getCloudPhoneClient(provider: CloudPhoneProvider = 'geelark'): CloudPhoneClient {
  switch (provider) {
    case 'geelark':
      return new GeeLarkClient()
    default:
      throw new Error(`Unsupported cloud phone provider: ${provider}`)
  }
}

export * from './types'
```

---

## 7. API routes

### 7.1 `POST /api/admin/cloud-phones/provision`

Admin-only. Bulk-provisions N phones for a given account, optionally assigning
each to a specified operator.

```typescript
// Request body:
{
  account_id: string,                  // tenant
  count: number,                        // how many phones to provision
  assignments?: Array<{                 // optional per-phone operator assignment
    label: string,
    operator_user_id?: string
  }>
}

// For each provision:
//   1. Call geelark.provisionPhone({label})
//   2. (Optional) Set proxy via geelark to anchor the IP
//   3. Insert ig_accounts row with cloud_phone_provider='geelark',
//      cloud_phone_profile_id=<id from GeeLark>, operator_user_id=<assigned>,
//      provisioned_at=now()
//   4. If assignments specify an operator, also assign in GeeLark via
//      geelark.assignPhoneToSubUser() — but only if the operator already has
//      a sub-user (look up accounts.cloud_phone_subusers[operator_user_id]).
//      If they don't, skip the GeeLark-side assignment and flag for manual setup.

// Response:
{
  provisioned: number,
  phones: Array<{
    ig_account_id: string,
    cloud_phone_profile_id: string,
    operator_user_id: string | null,
    needs_manual_assignment: boolean   // true if operator has no GeeLark sub-user yet
  }>
}
```

Auth: cookie-session admin.

### 7.2 `POST /api/admin/cloud-phones/create-subuser`

Admin-only. Creates a GeeLark sub-user for a specific operator and persists the
encrypted credential.

```typescript
// Request body:
{
  account_id: string,
  operator_user_id: string,
  display_name: string                 // shown in GeeLark dashboard
}

// 1. Call geelark.createSubUser({displayName})
// 2. Encrypt the returned password via lib/crypto.encrypt()
// 3. Patch accounts.cloud_phone_subusers JSON with
//      { [operator_user_id]: { subuser_username, subuser_password_enc, subuser_id } }
// 4. Return: { subuser_id, username, message: "Send credentials securely to operator" }
//    Note: do NOT return the plaintext password to the API caller after creation.
//    Send it to the operator via a separate Resend email (or one-time-link page).
```

### 7.3 `GET /api/operator/my-phones`

Operator-facing. Returns the list of phones assigned to the calling user.

```typescript
// Auth: cookie session
// Resolves caller's account_id via resolveAccountIdForUser
// Returns:
{
  phones: Array<{
    ig_account_id: string,
    ig_username: string,
    display_name: string,             // from account_identities.display_name
    cloud_phone_provider: 'geelark',
    status: 'ready' | 'warming' | 'provisioning' | 'failed',
    last_opened_at: string | null,
    today_dms_sent: number,           // from pending_outbound_messages count
    today_dms_remaining: number       // daily_cold_dm_limit - today_dms_sent
  }>
}
```

### 7.4 `POST /api/operator/open-phone`

Operator-facing. Returns a deep-link URL that opens the phone in a new tab,
and logs the session.

```typescript
// Request body: { ig_account_id: string }
// Auth: cookie session — caller must be operator_user_id on the ig_accounts row
//
// 1. Verify caller owns this phone (operator_user_id === user.id, OR is_admin)
// 2. Look up account_id from ig_accounts
// 3. Look up the operator's sub-user creds from accounts.cloud_phone_subusers
// 4. Call geelark.getPhoneDeepLink(profileId, subUserCreds)
// 5. Insert into cloud_phone_sessions: account_id, ig_account_id, operator_user_id,
//    operator_ip (from x-forwarded-for), user_agent, deep_link_url_hash (sha256)
// 6. Return: { launch_url: string }
//
// The client-side then does window.open(launch_url, '_blank').
```

---

## 8. UI pages

### 8.1 `/admin/cloud-phones/provision` — bulk provision wizard

New page at `src/app/(dashboard)/admin/cloud-phones/provision/page.tsx`.

Server component that lists all scouts/accounts. On select, opens a client
wizard with three steps:

1. **Scope** — how many phones, which account, optional label prefix
2. **Operator assignments** — drag-and-drop or dropdown to assign each phone
   to an operator (list of `account_members` for this account)
3. **Confirm & provision** — calls `POST /api/admin/cloud-phones/provision`,
   shows live progress, surfaces any `needs_manual_assignment` flags

Sidebar nav entry (in `src/components/shared/Sidebar.tsx` under `adminNavigation`):
```typescript
{ name: 'Cloud Phones', href: '/admin/cloud-phones/provision', icon: Smartphone },
```

### 8.2 `/operator/phones` — operator's daily worklist

New page at `src/app/(dashboard)/operator/phones/page.tsx`.
Client component. Fetches from `GET /api/operator/my-phones` on mount.

Layout: card per phone, ordered by `today_dms_remaining` descending. Each card:
- Display name + IG handle
- Status badge (Ready / Warming / Provisioning)
- "Today's progress: X / Y DMs sent"
- Big **"Open Phone"** button → POSTs to `/api/operator/open-phone`,
  then `window.open(launch_url)`
- Below the button: "First time on this browser?" link to a help page

Sidebar nav entry — under the regular nav (visible to all roles):
```typescript
{ name: 'My Phones', href: '/operator/phones', icon: Smartphone, roles: ['admin','scout'] },
```

(Hide it for users with zero assigned phones via conditional render.)

### 8.3 Operator handbook page

Static page at `src/app/(dashboard)/operator/handbook/page.tsx`. Server component
rendering a markdown-style page covering:

- The Anchor™ rule: one operator per phone, same IP
- Never share credentials
- What to do if you see a security challenge from Instagram
- Daily ceiling per phone — don't exceed
- How to log a problem

Content seeded from this doc, but written for operators (not for engineers).

---

## 9. Alias-generator integration

The existing `POST /api/admin/aliases/generate` (Phase B) currently returns this
checklist item:

> "Provision a NEW cloud phone for this alias (1:1 mapping — never share with
> other aliases)."

Replace that with automatic provisioning:

1. Inside Phase B handler, after generating brand + inserting `account_identities`:
   ```typescript
   const geelark = getCloudPhoneClient('geelark')
   const phone = await geelark.provisionPhone({
     label: `${account.name}-${brand.display_name}`,
   })
   ```
2. Update the inserted `account_identities` row: `cloud_phone_id = phone.profileId`.
3. Also create an `ig_accounts` row pre-populated with
   `cloud_phone_provider, cloud_phone_profile_id` and operator_user_id from the
   request (admin can specify which operator gets this alias).
4. Update the returned checklist to omit the manual provisioning step. The
   first remaining step becomes: *"Create the IG Business account on the
   provisioned cloud phone (id: {profileId})."*

---

## 10. Env vars to add

Add to `.env.local.example` AND set in Vercel production:

```
# GeeLark cloud phones (cloud-phone integration)
GEELARK_API_KEY=
GEELARK_API_BASE=https://api.geelark.com
```

Once these are set, the GeeLark client will activate. Without them, the lib
should throw `Error('GEELARK_API_KEY not configured — set it in your env')` —
do not fall back to a stub.

---

## 11. Provider research (decision log)

For full research details, see the chat history that spawned this doc. Summary:

- **GeeLark** — chosen. $29.90/device/mo, mature API, unlimited team seats,
  industry-recommended for IG.
- **BitBrowser / BitCloudPhone** — viable backup. Slightly cheaper at low usage,
  documented API (https://doc.bitbrowser.net/api-docs/cloud-phone-profiles),
  also has team features.
- **Multilogin Cloud Phones** — enterprise-grade, higher cost, save for later
  when scaling beyond 50 phones.
- **VMOS Cloud** — lower reliability per Trustpilot (2.8/5). Avoid for v1.
- **aliremote.com** — recommended by the user but **no third-party reviews
  exist** as of May 2026. Not in any major roundup. Defer until the user has
  done independent diligence on their pricing + API.

---

## 12. Pricing for the launch agency customer

The agency that triggered this build: 12 phones across 4 operators, Self-Operated tier.

| Line | Monthly |
|---|---|
| 12 GeeLark phones × $29.90 | $359 |
| GeeLark plan tier (Pro, for unlimited profiles + API + team) | $13 |
| Anthropic (cold DM + classify + reply + content) | $120 |
| Email infra (4 sender domains × ~$50) | $200 |
| Apify enrichment | $200 |
| Gemini Imagen | $35 |
| GHL share | $30 |
| Supabase + Vercel + Resend | $15 |
| Stripe fees | $90 |
| Replacement-account budget | $30 |
| **TOTAL COST** | **~$1,092** |

Recommended price: **$2,999/mo + $1,997 one-time onboarding**.
Gross margin: ~$1,900/mo (~63%). First-year revenue per agency: ~$38K.

---

## 13. Smoke tests before going live with the agency

Before billing the agency:

1. **Provision one phone via the new API** with a test account. Verify the
   GeeLark dashboard shows it, the profile_id is stored, and the deep-link
   opens the right phone.
2. **Create one sub-user, assign one phone, log in as that sub-user** in an
   incognito window. Confirm they only see their assigned phone — not all
   phones in the agency's fleet.
3. **End-to-end: alias generator Phase B → cloud phone provisioned → assigned
   to operator → operator opens via Praecora → IG warm-up begins.** This is
   the full path the agency will use weekly.
4. **Verify the `cloud_phone_sessions` audit log** is being written on every
   "Open Phone" click.

If all four pass, ship to the agency.

---

## 14. Sequencing recommendation

Implementation in dependency order:

1. **Day 1 AM:** Run the schema migration. Build `lib/cloud-phones/types.ts`
   and the empty `GeeLarkClient` skeleton. Sign up for GeeLark Base/Pro
   programmatic plan, get an API key, set it in `.env.local`.
2. **Day 1 PM:** Implement `GeeLarkClient.provisionPhone`, `getPhoneDeepLink`,
   `getPhoneStatus`. Smoke test against a real GeeLark account by provisioning
   one phone and opening it.
3. **Day 2 AM:** Build the four API routes (`provision`, `create-subuser`,
   `my-phones`, `open-phone`). Test each with `curl` or Postman.
4. **Day 2 PM:** Build the two UI pages (`/admin/cloud-phones/provision`,
   `/operator/phones`). Add sidebar entries.
5. **Day 3 AM:** Integrate Phase B of the alias generator to auto-provision.
   Run the full E2E smoke test from section 13.
6. **Day 3 afternoon:** If smoke passes, hand the spec + access to the agency
   customer and begin their onboarding.

---

## 15. Open questions the new session must resolve

Before / during implementation, you'll need answers (the user can resolve):

1. **GeeLark plan choice.** The user needs to subscribe. Pro tier with
   API access + unlimited profiles is ~$13/mo + per-device. Confirm with
   the user which plan tier to put on the company card.
2. **Sub-user creation via API.** If GeeLark's API doesn't support sub-user
   creation programmatically (only via dashboard), the `create-subuser`
   endpoint becomes admin-driven manual. Confirm by reading their docs.
3. **Operator IP anchoring strategy.** Each cloud phone should have a sticky
   residential proxy. The user needs to confirm whether GeeLark provides
   proxies natively or whether we BYO via a service like Bright Data or
   Soax. If BYO, add proxy-credential management to `lib/cloud-phones/`.
4. **What to do when an operator quits.** Spec doesn't cover re-anchoring an
   account to a new operator gracefully — Sentinel Protocol's Anchor™
   guidance says it's a 30-day gradual IP transition. Out of scope for v1.
5. **The Operator Handbook PDF** — needs to be written. Outline is in
   section 8.3 above. The user mentioned wanting this for the agency contract.

---

## 16. Files the new session will touch

**Modify (existing):**
- `src/app/api/admin/aliases/generate/route.ts` (replace manual checklist step
  with API call to GeeLark)
- `src/components/shared/Sidebar.tsx` (add "Cloud Phones" + "My Phones" nav)
- `.env.local.example` (add `GEELARK_API_KEY`, `GEELARK_API_BASE`)

**Create:**
- `migrations/2026-05-23-cloud-phone-integration.sql`
- `src/lib/cloud-phones/types.ts`
- `src/lib/cloud-phones/geelark.ts`
- `src/lib/cloud-phones/index.ts`
- `src/app/api/admin/cloud-phones/provision/route.ts`
- `src/app/api/admin/cloud-phones/create-subuser/route.ts`
- `src/app/api/operator/my-phones/route.ts`
- `src/app/api/operator/open-phone/route.ts`
- `src/app/(dashboard)/admin/cloud-phones/provision/page.tsx`
- `src/app/(dashboard)/admin/cloud-phones/provision/ProvisionWizard.tsx` (client)
- `src/app/(dashboard)/operator/phones/page.tsx`
- `src/app/(dashboard)/operator/phones/MyPhonesClient.tsx` (client)
- `src/app/(dashboard)/operator/handbook/page.tsx`

---

## 17. Definition of done

The build is complete when:

- `npm run build` passes cleanly
- `./node_modules/.bin/tsc --noEmit` passes cleanly
- All four smoke tests from section 13 pass
- An admin can provision 12 phones for an agency in a single wizard run
- An operator can log into Praecora, navigate to `/operator/phones`, see
  their 3 phones, click "Open Phone", and land in the right GeeLark phone
  in a new tab
- The `cloud_phone_sessions` table is being populated on every click
- Phase B of the alias generator auto-provisions a phone instead of
  returning a manual checklist step
- The Operator Handbook page exists and is linked from the operator's UI

---

*End of handoff doc. This file: `docs/CLOUD-PHONE-INTEGRATION-HANDOFF.md`.
The user should paste it (or its path) verbatim into a new Claude Code session
to begin implementation.*
