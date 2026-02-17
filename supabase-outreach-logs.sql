-- Outreach Logs Table
-- Run this SQL in your Supabase SQL Editor to add outreach history tracking

CREATE TABLE IF NOT EXISTS public.outreach_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scout_id UUID NOT NULL REFERENCES profiles(id),
    campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    leads_pushed INTEGER NOT NULL DEFAULT 0,
    leads_added INTEGER NOT NULL DEFAULT 0,
    leads_skipped INTEGER NOT NULL DEFAULT 0,
    deals_created INTEGER NOT NULL DEFAULT 0,
    artist_ids JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outreach_logs_scout ON outreach_logs(scout_id, created_at DESC);
CREATE INDEX idx_outreach_logs_campaign ON outreach_logs(campaign_id);

-- Enable RLS
ALTER TABLE outreach_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own logs
CREATE POLICY "auth_all" ON outreach_logs 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);
