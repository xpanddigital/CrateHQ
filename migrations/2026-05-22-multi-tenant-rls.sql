-- Multi-tenant refactor — Part 2 of 2: replace permissive RLS with
-- account-scoped policies.
--
-- PREREQUISITE: run `2026-05-22-multi-tenant-accounts.sql` first and verify
-- every row has account_id populated.
--
-- This migration drops the existing permissive (USING (true) / auth_all)
-- policies on every data table and replaces them with policies that scope
-- SELECT/UPDATE/DELETE/INSERT to the caller's account_ids.
--
-- Admins still see and manage everything.

-- ── artists ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "artists_select" ON public.artists;
DROP POLICY IF EXISTS "artists_insert" ON public.artists;
DROP POLICY IF EXISTS "artists_update" ON public.artists;
DROP POLICY IF EXISTS "artists_delete" ON public.artists;
DROP POLICY IF EXISTS "auth_all" ON public.artists;

CREATE POLICY "artists_select" ON public.artists FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "artists_insert" ON public.artists FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "artists_update" ON public.artists FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "artists_delete" ON public.artists FOR DELETE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── tags / artist_tags / deal_tags ─────────────────────────────────────
DROP POLICY IF EXISTS "tags_select" ON public.tags;
DROP POLICY IF EXISTS "tags_insert" ON public.tags;
DROP POLICY IF EXISTS "tags_update" ON public.tags;
DROP POLICY IF EXISTS "tags_delete" ON public.tags;

CREATE POLICY "tags_select" ON public.tags FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "tags_insert" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "tags_update" ON public.tags FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "tags_delete" ON public.tags FOR DELETE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- artist_tags / deal_tags: inherit from parent
DROP POLICY IF EXISTS "artist_tags_select" ON public.artist_tags;
DROP POLICY IF EXISTS "artist_tags_insert" ON public.artist_tags;
DROP POLICY IF EXISTS "artist_tags_delete" ON public.artist_tags;
CREATE POLICY "artist_tags_select" ON public.artist_tags FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artists a
    WHERE a.id = artist_tags.artist_id
      AND (a.account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  ));
CREATE POLICY "artist_tags_insert" ON public.artist_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.artists a
    WHERE a.id = artist_tags.artist_id
      AND (a.account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  ));
CREATE POLICY "artist_tags_delete" ON public.artist_tags FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artists a
    WHERE a.id = artist_tags.artist_id
      AND (a.account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  ));

-- ── deals ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals_select" ON public.deals;
DROP POLICY IF EXISTS "deals_insert" ON public.deals;
DROP POLICY IF EXISTS "deals_update" ON public.deals;
DROP POLICY IF EXISTS "deals_delete" ON public.deals;

CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── conversations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
DROP POLICY IF EXISTS "auth_all" ON public.conversations;

CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
-- INSERT: webhooks use service role (which bypasses RLS); scouts can insert
-- into their own account.
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── email_templates ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "templates_select" ON public.email_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.email_templates;
DROP POLICY IF EXISTS "templates_update" ON public.email_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.email_templates;

CREATE POLICY "templates_select" ON public.email_templates FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "templates_insert" ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "templates_update" ON public.email_templates FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "templates_delete" ON public.email_templates FOR DELETE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── enrichment_jobs / enrichment_queue / enrichment_batches ───────────
DROP POLICY IF EXISTS "enrichment_select" ON public.enrichment_jobs;
DROP POLICY IF EXISTS "enrichment_insert" ON public.enrichment_jobs;
DROP POLICY IF EXISTS "enrichment_update" ON public.enrichment_jobs;
DROP POLICY IF EXISTS "auth_all" ON public.enrichment_jobs;
DROP POLICY IF EXISTS "auth_all" ON public.enrichment_batches;
DROP POLICY IF EXISTS "auth_all" ON public.enrichment_queue;

CREATE POLICY "enrichment_jobs_select" ON public.enrichment_jobs FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "enrichment_jobs_insert" ON public.enrichment_jobs FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
CREATE POLICY "enrichment_jobs_update" ON public.enrichment_jobs FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

CREATE POLICY "enrichment_batches_all" ON public.enrichment_batches FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

CREATE POLICY "enrichment_queue_all" ON public.enrichment_queue FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── integrations ───────────────────────────────────────────────────────
-- Was previously per-user (user_id = auth.uid()). Switch to account-scoped
-- so VAs/admins on the same account can share API keys.
DROP POLICY IF EXISTS "integrations_all" ON public.integrations;
CREATE POLICY "integrations_all" ON public.integrations FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── ig_accounts / pending_outbound_messages / agent_heartbeats ────────
DROP POLICY IF EXISTS "auth_all" ON public.ig_accounts;
DROP POLICY IF EXISTS "auth_all" ON public.pending_outbound_messages;
DROP POLICY IF EXISTS "auth_all" ON public.agent_heartbeats;

CREATE POLICY "ig_accounts_all" ON public.ig_accounts FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

CREATE POLICY "pending_outbound_all" ON public.pending_outbound_messages FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

CREATE POLICY "agent_heartbeats_all" ON public.agent_heartbeats FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── content engine: knowledge_bases / account_identities / content_posts / content_topics ──
-- Previously NO RLS at all. Enable it and scope to account.
ALTER TABLE public.knowledge_bases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_identities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_topics      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_bases_all" ON public.knowledge_bases FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

CREATE POLICY "account_identities_all" ON public.account_identities FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

CREATE POLICY "content_posts_all" ON public.content_posts FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

CREATE POLICY "content_topics_all" ON public.content_topics FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── sequences: templates / enrollments / step_log / session_schedule ──
-- Previously admin-only. Now account-scoped so each scout has their own
-- sequence library.
DROP POLICY IF EXISTS "sequence_templates_select" ON public.sequence_templates;
DROP POLICY IF EXISTS "sequence_templates_insert" ON public.sequence_templates;
DROP POLICY IF EXISTS "sequence_templates_update" ON public.sequence_templates;
DROP POLICY IF EXISTS "sequence_templates_delete" ON public.sequence_templates;

CREATE POLICY "sequence_templates_all" ON public.sequence_templates FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

DROP POLICY IF EXISTS "sequence_enrollments_admin_all" ON public.sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_scout_select" ON public.sequence_enrollments;
CREATE POLICY "sequence_enrollments_all" ON public.sequence_enrollments FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

DROP POLICY IF EXISTS "sequence_step_log_admin_all" ON public.sequence_step_log;
CREATE POLICY "sequence_step_log_all" ON public.sequence_step_log FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

DROP POLICY IF EXISTS "session_schedule_admin_all" ON public.session_schedule;
CREATE POLICY "session_schedule_all" ON public.session_schedule FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  WITH CHECK (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());

-- ── deal_tags inherits via deals ──────────────────────────────────────
DROP POLICY IF EXISTS "deal_tags_select" ON public.deal_tags;
DROP POLICY IF EXISTS "deal_tags_insert" ON public.deal_tags;
DROP POLICY IF EXISTS "deal_tags_delete" ON public.deal_tags;
CREATE POLICY "deal_tags_select" ON public.deal_tags FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_tags.deal_id
      AND (d.account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  ));
CREATE POLICY "deal_tags_insert" ON public.deal_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_tags.deal_id
      AND (d.account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  ));
CREATE POLICY "deal_tags_delete" ON public.deal_tags FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_tags.deal_id
      AND (d.account_id IN (SELECT public.user_account_ids()) OR public.is_admin())
  ));

-- profiles RLS is unchanged: every user can SELECT all profile rows (needed
-- for "assigned to: X" displays). UPDATE is locked to own row + role-change
-- trigger from the secure-profiles-role migration.
