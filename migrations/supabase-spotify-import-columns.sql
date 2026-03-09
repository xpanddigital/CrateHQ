-- New columns for raw Spotify scrape import support.
-- Run this in Supabase SQL Editor.

ALTER TABLE artists ADD COLUMN IF NOT EXISTS spotify_id TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS spotify_followers INTEGER;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS spotify_verified BOOLEAN;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS world_rank INTEGER;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio_emails JSONB;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS cover_art_url TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS latest_release_date DATE;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS latest_release_name TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS total_top_track_streams BIGINT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS top_cities JSONB;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS wikipedia_url TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS import_format TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_spotify_id ON artists(spotify_id) WHERE spotify_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
