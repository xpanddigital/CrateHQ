-- Multi-tenant refactor — supplemental. Adds account_id + scoped RLS to the
-- tables that were missed in the first pass:
--   - outreach_logs
--   - artist_snapshots
--   - enrichment_logs
--   - enrichment_detailed_logs
--   - email_rejection_rules
--   - marketplace_installs (if it exists)
--
-- Run AFTER 2026-05-22-multi-tenant-accounts.sql and -rls.sql.
-- Safe to re-run.

-- ── outreach_logs ──────────────────────────────────────────────────────
ALTER TABLE public.outreach_logs   ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_outreach_logs_account ON public.outreach_logs(account_id);

-- Backfill via scout_id → profiles → account_members
UPDATE public.outreach_logs ol
SET account_id = (
  SELECT am.account_id FROM public.account_members am
  WHERE am.user_id = ol.scout_id
  ORDER BY am.created_at LIMIT 1
)
WHERE ol.account_id IS NULL;

DROP POLICY IF EXISTS "auth_all" ON public.outreach_logs;
CREATE POLICY "outreach_logs_all" ON public.outreach_logs FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── artist_snapshots ────────────────────────────────────────────────────
ALTER TABLE public.artist_snapshots ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_artist_snapshots_account ON public.artist_snapshots(account_id);

-- Backfill from the parent artist's account
UPDATE public.artist_snapshots s
SET account_id = a.account_id
FROM public.artists a
WHERE s.artist_id = a.id AND s.account_id IS NULL;

DROP POLICY IF EXISTS "auth_all" ON public.artist_snapshots;
CREATE POLICY "artist_snapshots_all" ON public.artist_snapshots FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── enrichment_logs ────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrichment_logs') THEN
    ALTER TABLE public.enrichment_logs ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_enrichment_logs_account ON public.enrichment_logs(account_id);

    UPDATE public.enrichment_logs el
    SET account_id = a.account_id
    FROM public.artists a
    WHERE el.artist_id = a.id AND el.account_id IS NULL;

    DROP POLICY IF EXISTS "auth_all" ON public.enrichment_logs;
    EXECUTE 'CREATE POLICY "enrichment_logs_all" ON public.enrichment_logs FOR ALL TO authenticated
      USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
      WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())';
  END IF;
END $$;

-- ── enrichment_detailed_logs ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrichment_detailed_logs') THEN
    ALTER TABLE public.enrichment_detailed_logs ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_enrichment_detailed_logs_account ON public.enrichment_detailed_logs(account_id);

    UPDATE public.enrichment_detailed_logs edl
    SET account_id = a.account_id
    FROM public.artists a
    WHERE edl.artist_id = a.id AND edl.account_id IS NULL;

    DROP POLICY IF EXISTS "auth_all" ON public.enrichment_detailed_logs;
    EXECUTE 'CREATE POLICY "enrichment_detailed_logs_all" ON public.enrichment_detailed_logs FOR ALL TO authenticated
      USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
      WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())';
  END IF;
END $$;

-- ── email_rejection_rules ──────────────────────────────────────────────
-- This table has no created_by column on the live schema, so we cannot
-- attribute existing rows to a user / account. Strategy: add account_id as
-- nullable, leave existing rows NULL (treated as global blocklist visible
-- only to admins per the policy below), and let new rows be inserted with
-- an account_id from the API layer.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_rejection_rules') THEN
    ALTER TABLE public.email_rejection_rules ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_email_rejection_rules_account ON public.email_rejection_rules(account_id);

    DROP POLICY IF EXISTS "auth_all" ON public.email_rejection_rules;
    EXECUTE 'CREATE POLICY "email_rejection_rules_all" ON public.email_rejection_rules FOR ALL TO authenticated
      USING (account_id IS NULL OR account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
      WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())';
  END IF;
END $$;

-- ── marketplace_installs (optional) ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketplace_installs') THEN
    ALTER TABLE public.marketplace_installs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "auth_all" ON public.marketplace_installs;
    EXECUTE 'CREATE POLICY "marketplace_installs_admin_only" ON public.marketplace_installs FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin())';
  END IF;
END $$;
