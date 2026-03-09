-- Fix run_by column: change from UUID (FK to profiles) to TEXT
-- so server-side cron worker can log with 'cron-worker' as the value.

-- Drop the foreign key constraint if it exists
ALTER TABLE enrichment_logs DROP CONSTRAINT IF EXISTS enrichment_logs_run_by_fkey;

-- Change column type from UUID to TEXT
ALTER TABLE enrichment_logs ALTER COLUMN run_by TYPE TEXT USING run_by::TEXT;
