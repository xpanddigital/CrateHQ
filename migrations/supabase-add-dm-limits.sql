-- Add a configurable daily limit for cold DMs
ALTER TABLE ig_accounts 
ADD COLUMN daily_cold_dm_limit INT DEFAULT 3;
