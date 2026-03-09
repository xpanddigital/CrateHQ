-- Migration: Replace permissive RLS policies with proper user-scoped policies
-- Run this in your Supabase SQL Editor
-- Date: 2026-03-09

-- Step 1: Drop all existing permissive "auth_all" policies
DROP POLICY IF EXISTS "auth_all" ON profiles;
DROP POLICY IF EXISTS "auth_all" ON artists;
DROP POLICY IF EXISTS "auth_all" ON artist_tags;
DROP POLICY IF EXISTS "auth_all" ON tags;
DROP POLICY IF EXISTS "auth_all" ON deals;
DROP POLICY IF EXISTS "auth_all" ON deal_tags;
DROP POLICY IF EXISTS "auth_all" ON conversations;
DROP POLICY IF EXISTS "auth_all" ON email_templates;
DROP POLICY IF EXISTS "auth_all" ON enrichment_jobs;
DROP POLICY IF EXISTS "auth_all" ON integrations;

-- Step 2: Helper function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 3: Profiles — read all, update own (admins update any)
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Step 4: Artists — shared resource, all can read/create/update; only admins delete
CREATE POLICY "artists_select" ON artists FOR SELECT TO authenticated USING (true);
CREATE POLICY "artists_insert" ON artists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "artists_update" ON artists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "artists_delete" ON artists FOR DELETE TO authenticated
  USING (public.is_admin());

-- Step 5: Artist tags — shared
CREATE POLICY "artist_tags_select" ON artist_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "artist_tags_insert" ON artist_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "artist_tags_delete" ON artist_tags FOR DELETE TO authenticated USING (true);

-- Step 6: Tags — shared, only admins delete
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated
  USING (public.is_admin());

-- Step 7: Deals — scouts see own, admins see all
CREATE POLICY "deals_select" ON deals FOR SELECT TO authenticated
  USING (scout_id = auth.uid() OR public.is_admin());
CREATE POLICY "deals_insert" ON deals FOR INSERT TO authenticated
  WITH CHECK (scout_id = auth.uid());
CREATE POLICY "deals_update" ON deals FOR UPDATE TO authenticated
  USING (scout_id = auth.uid() OR public.is_admin());
CREATE POLICY "deals_delete" ON deals FOR DELETE TO authenticated
  USING (public.is_admin());

-- Step 8: Deal tags — follows deals scope
CREATE POLICY "deal_tags_select" ON deal_tags FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_tags.deal_id
      AND (deals.scout_id = auth.uid() OR public.is_admin())
  ));
CREATE POLICY "deal_tags_insert" ON deal_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_tags.deal_id
      AND (deals.scout_id = auth.uid() OR public.is_admin())
  ));
CREATE POLICY "deal_tags_delete" ON deal_tags FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_tags.deal_id
      AND (deals.scout_id = auth.uid() OR public.is_admin())
  ));

-- Step 9: Conversations — scouts see their deals' conversations, admins see all
CREATE POLICY "conversations_select" ON conversations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.artist_id = conversations.artist_id
        AND deals.scout_id = auth.uid()
    )
  );
CREATE POLICY "conversations_insert" ON conversations FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "conversations_update" ON conversations FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.artist_id = conversations.artist_id
        AND deals.scout_id = auth.uid()
    )
  );

-- Step 10: Email templates — shared, creator/admin can modify
CREATE POLICY "templates_select" ON email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_insert" ON email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "templates_update" ON email_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "templates_delete" ON email_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- Step 11: Enrichment jobs — shared pipeline
CREATE POLICY "enrichment_select" ON enrichment_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "enrichment_insert" ON enrichment_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "enrichment_update" ON enrichment_jobs FOR UPDATE TO authenticated USING (true);

-- Step 12: Integrations — strictly per-user (already correct, recreate for consistency)
CREATE POLICY "integrations_all" ON integrations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Step 13: Fix signup trigger to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'scout'  -- Always default to scout; admin role must be granted by an existing admin
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
