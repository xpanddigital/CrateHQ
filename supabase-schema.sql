-- CrateHQ Database Schema
-- Run this SQL in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'scout' CHECK (role IN ('admin', 'scout')),
    avatar_url TEXT,
    phone TEXT,
    calendly_link TEXT,
    commission_rate NUMERIC(5,4) DEFAULT 0.08,
    ai_sdr_persona TEXT DEFAULT 'professional',
    ai_sdr_auto_send BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Auto-create profile on user signup
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tags table
CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6C5CE7',
    description TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Artists table
CREATE TABLE public.artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    spotify_url TEXT,
    country TEXT,
    biography TEXT,
    genres JSONB DEFAULT '[]',
    image_url TEXT,
    spotify_monthly_listeners BIGINT DEFAULT 0,
    streams_last_month BIGINT DEFAULT 0,
    streams_daily BIGINT DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    growth_mom NUMERIC(8,6) DEFAULT 0,
    growth_qoq NUMERIC(8,6) DEFAULT 0,
    growth_yoy NUMERIC(8,6) DEFAULT 0,
    growth_status TEXT,
    artist_level TEXT,
    instagram_handle TEXT,
    instagram_followers BIGINT DEFAULT 0,
    tiktok_handle TEXT,
    twitter_handle TEXT,
    website TEXT,
    social_links JSONB DEFAULT '{}',
    email TEXT,
    email_secondary TEXT,
    email_management TEXT,
    email_source TEXT,
    email_confidence NUMERIC(3,2) DEFAULT 0,
    all_emails_found JSONB DEFAULT '[]',
    estimated_offer INTEGER,
    estimated_offer_low INTEGER,
    estimated_offer_high INTEGER,
    is_enriched BOOLEAN DEFAULT false,
    is_contactable BOOLEAN DEFAULT false,
    enrichment_attempts INTEGER DEFAULT 0,
    last_enriched_at TIMESTAMPTZ,
    source TEXT DEFAULT 'manual',
    source_batch TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_artists_email ON artists(email) WHERE email IS NOT NULL;
CREATE INDEX idx_artists_contactable ON artists(is_contactable, estimated_offer DESC);

-- Artist tags junction table
CREATE TABLE public.artist_tags (
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (artist_id, tag_id)
);

CREATE INDEX idx_artist_tags_tag ON artist_tags(tag_id);

-- Deals table
CREATE TABLE public.deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id),
    scout_id UUID NOT NULL REFERENCES profiles(id),
    stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN (
        'new', 'enriched', 'outreach_queued', 'contacted', 'replied',
        'interested', 'call_scheduled', 'call_completed', 'qualified',
        'handed_off', 'in_negotiation', 'contract_sent',
        'closed_won', 'closed_lost', 'nurture'
    )),
    stage_changed_at TIMESTAMPTZ DEFAULT now(),
    outreach_channel TEXT DEFAULT 'email',
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    last_outreach_at TIMESTAMPTZ,
    last_reply_at TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ,
    instantly_campaign_id TEXT,
    estimated_deal_value INTEGER,
    actual_deal_value INTEGER,
    commission_amount INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deals_scout ON deals(scout_id, stage);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_artist_id ON deals(artist_id);

-- Deal tags junction table
CREATE TABLE public.deal_tags (
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (deal_id, tag_id)
);

-- Conversations table
-- Note: This table evolved from the original deal-centric design. It retains
-- deal_id for backwards compatibility but primarily links to artists.
-- Webhook-inserted messages use message_text/sender/external_id; UI-created
-- messages use body/subject/sent_at. Both patterns coexist.
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id),
    artist_id UUID REFERENCES artists(id),
    scout_id UUID REFERENCES profiles(id),
    channel TEXT NOT NULL CHECK (channel IN ('email', 'instagram', 'phone', 'note', 'system')),
    direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound', 'internal')),
    subject TEXT,
    body TEXT,
    message_text TEXT NOT NULL DEFAULT '',
    sender TEXT,
    external_id TEXT,
    ig_thread_id TEXT,
    ig_account_id UUID,
    ig_message_id TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read BOOLEAN DEFAULT false,
    ai_classification TEXT,
    ai_confidence NUMERIC(3,2),
    ai_suggested_reply TEXT,
    requires_human_review BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_artist_id ON conversations(artist_id);
CREATE INDEX idx_conversations_deal_id ON conversations(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_conversations_external_id ON conversations(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_conversations_ig_thread ON conversations(ig_thread_id) WHERE ig_thread_id IS NOT NULL;
CREATE INDEX idx_conversations_unread ON conversations(is_read) WHERE is_read = false;

-- Email templates table
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    sequence_position INTEGER,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    times_sent INTEGER DEFAULT 0,
    times_replied INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enrichment jobs table
CREATE TABLE public.enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    results JSONB DEFAULT '{}',
    email_found TEXT,
    email_confidence NUMERIC(3,2),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Integrations table
CREATE TABLE public.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    service TEXT NOT NULL,
    api_key TEXT,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, service)
);

-- ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Helper: atomic increment for emails_opened (avoids read-then-write race condition)
CREATE OR REPLACE FUNCTION public.increment_emails_opened(deal_id UUID)
RETURNS VOID AS $$
  UPDATE public.deals
  SET emails_opened = COALESCE(emails_opened, 0) + 1
  WHERE id = deal_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users can read all profiles, but only update their own (admins can update any)
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Artists: shared resource, all authenticated users can read; only admins can delete
CREATE POLICY "artists_select" ON artists FOR SELECT TO authenticated USING (true);
CREATE POLICY "artists_insert" ON artists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "artists_update" ON artists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "artists_delete" ON artists FOR DELETE TO authenticated
  USING (public.is_admin());

-- Artist tags: shared (follows artists access pattern)
CREATE POLICY "artist_tags_select" ON artist_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "artist_tags_insert" ON artist_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "artist_tags_delete" ON artist_tags FOR DELETE TO authenticated USING (true);

-- Tags: shared resource, all can read/create; only admins can delete
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated
  USING (public.is_admin());

-- Deals: scouts see only their own deals; admins see all
CREATE POLICY "deals_select" ON deals FOR SELECT TO authenticated
  USING (scout_id = auth.uid() OR public.is_admin());
CREATE POLICY "deals_insert" ON deals FOR INSERT TO authenticated
  WITH CHECK (scout_id = auth.uid());
CREATE POLICY "deals_update" ON deals FOR UPDATE TO authenticated
  USING (scout_id = auth.uid() OR public.is_admin());
CREATE POLICY "deals_delete" ON deals FOR DELETE TO authenticated
  USING (public.is_admin());

-- Deal tags: follows deals access pattern
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

-- Conversations: scouts see conversations for their deals; admins see all
CREATE POLICY "conversations_select" ON conversations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.artist_id = conversations.artist_id
        AND deals.scout_id = auth.uid()
    )
  );
CREATE POLICY "conversations_insert" ON conversations FOR INSERT TO authenticated
  WITH CHECK (true);  -- Webhooks insert via service role; scouts insert via their deals
CREATE POLICY "conversations_update" ON conversations FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM deals WHERE deals.artist_id = conversations.artist_id
        AND deals.scout_id = auth.uid()
    )
  );

-- Email templates: shared resource, all can read/create; only creator or admin can modify
CREATE POLICY "templates_select" ON email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_insert" ON email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "templates_update" ON email_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "templates_delete" ON email_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- Enrichment jobs: shared (part of global enrichment pipeline)
CREATE POLICY "enrichment_select" ON enrichment_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "enrichment_insert" ON enrichment_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "enrichment_update" ON enrichment_jobs FOR UPDATE TO authenticated USING (true);

-- Integrations: strictly per-user
CREATE POLICY "integrations_all" ON integrations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
