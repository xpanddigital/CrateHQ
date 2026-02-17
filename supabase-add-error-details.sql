-- Add error_details column to enrichment_logs table
-- This stores the raw Apify API response when calls fail (non-200 status or non-JSON)
ALTER TABLE enrichment_logs ADD COLUMN IF NOT EXISTS error_details TEXT;
