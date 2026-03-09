-- Add streams_estimated flag to artists table
-- When true, streams_last_month was derived from monthly_listeners * 3.5
ALTER TABLE artists ADD COLUMN IF NOT EXISTS streams_estimated BOOLEAN DEFAULT false;
