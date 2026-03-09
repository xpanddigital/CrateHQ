-- Add a foreign key to link the IG account to a specific scout
ALTER TABLE ig_accounts 
ADD COLUMN assigned_scout_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
