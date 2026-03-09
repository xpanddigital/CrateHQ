-- Artist Snapshots Table for Growth Tracking
-- Run this in Supabase SQL Editor

CREATE TABLE public.artist_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    spotify_monthly_listeners BIGINT,
    streams_last_month BIGINT,
    track_count INTEGER,
    instagram_followers BIGINT,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(artist_id, snapshot_date)
);

CREATE INDEX idx_snapshots_artist_date ON artist_snapshots(artist_id, snapshot_date DESC);

ALTER TABLE artist_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON artist_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
