-- Multi-tenant refactor — Part 1 of 2: schema + backfill
--
-- Before this migration the app was single-tenant: every authenticated user
-- could read every other user's artists, tags, templates, etc. (most tables
-- had RLS `USING (true)`.) This is unacceptable once paying scouts share the
-- database.
--
-- This migration introduces:
--   - `accounts` table: the tenant boundary. One per paying scout (could later
--     hold a team, e.g. a scout + VAs).
--   - `account_members` join: many-to-many between auth users and accounts,
--     with a per-membership role (`owner`/`admin`/`member`).
--   - `account_id` column on every data table.
--   - Backfill: every existing row → one beta account owned by the first
--     admin in the profiles table. This preserves the existing single-tenant
--     dataset for Joel.
--
-- Run this in the Supabase SQL Editor.
-- AFTER this completes, run `2026-05-22-multi-tenant-rls.sql` (Part 2) to
-- replace the permissive RLS policies with account-scoped ones.

-- ── 1. Core tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- Optional FK to the billing record. Set when a scout pays via Stripe.
    scout_id UUID UNIQUE REFERENCES public.scouts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_scout ON public.accounts(scout_id);

CREATE TABLE IF NOT EXISTS public.account_members (
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- 'owner' = the paying scout (one per account); 'admin' = can manage
    -- members but not delete the account; 'member' = VA / collaborator
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_members_user ON public.account_members(user_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Helper: returns the set of account_ids the calling auth user belongs to.
-- SECURITY DEFINER + STABLE → fast in RLS policies, doesn't recurse.
CREATE OR REPLACE FUNCTION public.user_account_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.account_members WHERE user_id = auth.uid();
$$;

-- Accounts RLS: users see accounts they belong to; admins see everything.
DROP POLICY IF EXISTS "accounts_member_select" ON public.accounts;
CREATE POLICY "accounts_member_select" ON public.accounts FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_account_ids()) OR public.is_admin());

DROP POLICY IF EXISTS "accounts_owner_update" ON public.accounts;
CREATE POLICY "accounts_owner_update" ON public.accounts FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_id = accounts.id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "account_members_self_select" ON public.account_members;
CREATE POLICY "account_members_self_select" ON public.account_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR account_id IN (SELECT public.user_account_ids())
  );

DROP POLICY IF EXISTS "account_members_owner_manage" ON public.account_members;
CREATE POLICY "account_members_owner_manage" ON public.account_members FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.account_members AS am
      WHERE am.account_id = account_members.account_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- ── 2. Add account_id to every data table ──────────────────────────────────
-- Nullable for now; the backfill populates them; Part 2 of the migration
-- (or a follow-up after verification) flips them to NOT NULL.

ALTER TABLE public.artists                  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.tags                     ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.deals                    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.conversations            ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.email_templates          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.enrichment_jobs          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.enrichment_batches       ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.enrichment_queue         ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.integrations             ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.ig_accounts              ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.pending_outbound_messages ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.agent_heartbeats         ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_bases          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.account_identities       ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.content_posts            ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.content_topics           ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.sequence_templates       ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.sequence_enrollments     ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.sequence_step_log        ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.session_schedule         ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Indexes for RLS performance — every account_id filter hits these
CREATE INDEX IF NOT EXISTS idx_artists_account              ON public.artists(account_id);
CREATE INDEX IF NOT EXISTS idx_tags_account                 ON public.tags(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_account                ON public.deals(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_account        ON public.conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_account      ON public.email_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_account      ON public.enrichment_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_account   ON public.enrichment_batches(account_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_account     ON public.enrichment_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_integrations_account         ON public.integrations(account_id);
CREATE INDEX IF NOT EXISTS idx_ig_accounts_account          ON public.ig_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_pending_outbound_account     ON public.pending_outbound_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_account     ON public.agent_heartbeats(account_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_account      ON public.knowledge_bases(account_id);
CREATE INDEX IF NOT EXISTS idx_account_identities_account   ON public.account_identities(account_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_account        ON public.content_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_content_topics_account       ON public.content_topics(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_templates_account   ON public.sequence_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_account ON public.sequence_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_step_log_account    ON public.sequence_step_log(account_id);
CREATE INDEX IF NOT EXISTS idx_session_schedule_account     ON public.session_schedule(account_id);

-- ── 3. Backfill: create the beta account and assign every existing row ─────

DO $$
DECLARE
  beta_account_id UUID;
  beta_owner_id UUID;
BEGIN
  -- Pick the first admin as the beta account owner. If no admin exists yet,
  -- pick the oldest profile. (This is a one-off bootstrap.)
  SELECT id INTO beta_owner_id FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF beta_owner_id IS NULL THEN
    SELECT id INTO beta_owner_id FROM public.profiles ORDER BY created_at LIMIT 1;
  END IF;

  IF beta_owner_id IS NULL THEN
    -- Empty DB; nothing to backfill. Skip cleanly.
    RAISE NOTICE 'No profiles exist; skipping backfill';
    RETURN;
  END IF;

  -- Create or reuse the beta account
  SELECT id INTO beta_account_id FROM public.accounts WHERE name = 'Beta (pre-multi-tenant data)' LIMIT 1;
  IF beta_account_id IS NULL THEN
    INSERT INTO public.accounts (name) VALUES ('Beta (pre-multi-tenant data)')
    RETURNING id INTO beta_account_id;
  END IF;

  -- Make the bootstrap owner a member
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (beta_account_id, beta_owner_id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Backfill every row that doesn't yet have an account_id
  UPDATE public.artists                  SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.tags                     SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.deals                    SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.conversations            SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.email_templates          SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.enrichment_jobs          SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.enrichment_batches       SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.enrichment_queue         SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.integrations             SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.ig_accounts              SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.pending_outbound_messages SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.agent_heartbeats         SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.knowledge_bases          SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.account_identities       SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.content_posts            SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.content_topics           SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.sequence_templates       SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.sequence_enrollments     SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.sequence_step_log        SET account_id = beta_account_id WHERE account_id IS NULL;
  UPDATE public.session_schedule         SET account_id = beta_account_id WHERE account_id IS NULL;

  -- Also link existing scouts (billing) rows to the beta account where missing
  UPDATE public.accounts SET scout_id = (
    SELECT id FROM public.scouts WHERE profile_id = beta_owner_id LIMIT 1
  )
  WHERE id = beta_account_id AND scout_id IS NULL;

  RAISE NOTICE 'Backfill complete. Beta account: %, owner: %', beta_account_id, beta_owner_id;
END $$;

-- ── 4. NOT NULL constraints (run AFTER verifying backfill) ────────────────
-- Commented out so this migration is safe to re-run; uncomment and re-run
-- once you've verified every table has account_id populated.
--
-- ALTER TABLE public.artists                  ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.tags                     ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.deals                    ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.conversations            ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.email_templates          ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.enrichment_jobs          ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.enrichment_batches       ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.enrichment_queue         ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.integrations             ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.ig_accounts              ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.pending_outbound_messages ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.agent_heartbeats         ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.knowledge_bases          ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.account_identities       ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.content_posts            ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.content_topics           ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.sequence_templates       ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.sequence_enrollments     ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.sequence_step_log        ALTER COLUMN account_id SET NOT NULL;
-- ALTER TABLE public.session_schedule         ALTER COLUMN account_id SET NOT NULL;
