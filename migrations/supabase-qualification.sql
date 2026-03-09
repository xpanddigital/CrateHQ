-- Add qualification columns to artists table
ALTER TABLE artists ADD COLUMN IF NOT EXISTS qualification_status text DEFAULT 'pending';
ALTER TABLE artists ADD COLUMN IF NOT EXISTS qualification_reason text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS qualification_date timestamptz;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS qualification_manual_override boolean DEFAULT false;

-- Add email rejection columns
ALTER TABLE artists ADD COLUMN IF NOT EXISTS email_rejected boolean DEFAULT false;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS email_rejection_reason text;

-- Index for fast filtering by qualification status
CREATE INDEX IF NOT EXISTS idx_artists_qualification_status ON artists(qualification_status);
