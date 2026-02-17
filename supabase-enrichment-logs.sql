-- Enrichment Logs Table
-- Run this SQL in your Supabase SQL Editor to track enrichment history

CREATE TABLE IF NOT EXISTS public.enrichment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    artist_name TEXT NOT NULL,
    email_found TEXT,
    email_confidence NUMERIC(3,2) DEFAULT 0,
    email_source TEXT,
    all_emails JSONB DEFAULT '[]',
    steps JSONB DEFAULT '[]',
    total_duration_ms INTEGER DEFAULT 0,
    is_contactable BOOLEAN DEFAULT false,
    run_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_logs_artist ON enrichment_logs(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_run_by ON enrichment_logs(run_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_contactable ON enrichment_logs(is_contactable, created_at DESC);

-- Enable RLS
ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all logs (use DO block to avoid error if already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enrichment_logs' AND policyname = 'auth_all') THEN
        CREATE POLICY "auth_all" ON enrichment_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;
