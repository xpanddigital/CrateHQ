ALTER TABLE pending_outbound_messages 
ADD COLUMN is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN scheduled_for TIMESTAMPTZ DEFAULT NOW();