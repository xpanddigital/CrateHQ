-- Artist Snapshots Table
-- Stores daily snapshots of artist metrics for growth tracking.
-- One row per artist per day (UNIQUE constraint on artist_id + snapshot_date).

CREATE TABLE IF NOT EXISTS public.artist_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    spotify_monthly_listeners INTEGER,
    streams_last_month BIGINT,
    instagram_followers INTEGER,
    track_count INTEGER,
    estimated_offer NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(artist_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_artist ON artist_snapshots(artist_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON artist_snapshots(snapshot_date DESC);

ALTER TABLE artist_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'artist_snapshots' AND policyname = 'auth_all') THEN
        CREATE POLICY "auth_all" ON artist_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;
