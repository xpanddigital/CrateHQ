-- Add enrichment-discovered columns to artists if missing.
-- Run in Supabase SQL Editor. Safe to re-run.

ALTER TABLE artists ADD COLUMN IF NOT EXISTS management_company TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS booking_agency TEXT;
