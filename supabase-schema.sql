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

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'scout')
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

-- Deal tags junction table
CREATE TABLE public.deal_tags (
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (deal_id, tag_id)
);

-- Conversations table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id),
    scout_id UUID REFERENCES profiles(id),
    channel TEXT NOT NULL CHECK (channel IN ('email', 'instagram', 'phone', 'note', 'system')),
    direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound', 'internal')),
    subject TEXT,
    body TEXT NOT NULL,
    ai_classification TEXT,
    ai_confidence NUMERIC(3,2),
    ai_suggested_reply TEXT,
    is_read BOOLEAN DEFAULT false,
    requires_human_review BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_deal ON conversations(deal_id, sent_at DESC);

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

-- Permissive policies for authenticated users
CREATE POLICY "auth_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON artists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON artist_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON deal_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON enrichment_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON integrations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
