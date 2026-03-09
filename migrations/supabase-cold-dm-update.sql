-- Add columns for cold outreach
ALTER TABLE pending_outbound_messages 
ADD COLUMN target_username TEXT,
ADD COLUMN outreach_type TEXT DEFAULT 'reply' CHECK (outreach_type IN ('reply', 'cold'));

-- Make ig_thread_id nullable because cold DMs will not have a thread ID yet
ALTER TABLE pending_outbound_messages
ALTER COLUMN ig_thread_id DROP NOT NULL;
