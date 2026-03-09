-- Instagram DM Support: conversations, outbound queue, IG accounts, heartbeats
-- Run in Supabase SQL Editor
--
-- Safe to re-run: drops and recreates tables that may be incomplete from a prior attempt.

-- Drop incomplete tables from any previous partial run (no data to lose yet)
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS pending_outbound_messages CASCADE;
DROP TABLE IF EXISTS ig_accounts CASCADE;
DROP TABLE IF EXISTS agent_heartbeats CASCADE;

-- 1. conversations — unified message store for all channels
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES artists(id),
  channel TEXT NOT NULL CHECK (channel IN ('instagram', 'email')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text TEXT NOT NULL,
  sender TEXT,
  ig_account_id TEXT,
  ig_thread_id TEXT,
  ig_message_id TEXT,
  external_id TEXT,
  scout_id UUID,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_conversations_ig_message_id
  ON conversations (ig_message_id) WHERE ig_message_id IS NOT NULL;

CREATE INDEX idx_conversations_artist_id
  ON conversations (artist_id);

CREATE INDEX idx_conversations_created_at
  ON conversations (created_at DESC);


-- 2. pending_outbound_messages — queue for scout replies
CREATE TABLE pending_outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id TEXT NOT NULL,
  ig_thread_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  scout_id UUID,
  artist_id UUID REFERENCES artists(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);


-- 3. ig_accounts — Instagram account configuration
CREATE TABLE ig_accounts (
  id TEXT PRIMARY KEY,
  ig_username TEXT NOT NULL,
  vm_identifier TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  active_start_hour INT DEFAULT 8,
  active_end_hour INT DEFAULT 22,
  poll_interval_active_min INT DEFAULT 3,
  poll_interval_wind_down_min INT DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  webhook_secret TEXT NOT NULL,
  last_heartbeat TIMESTAMPTZ,
  status TEXT DEFAULT 'offline',
  created_at TIMESTAMPTZ DEFAULT now()
);


-- 4. agent_heartbeats — health monitoring log
CREATE TABLE agent_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id TEXT NOT NULL,
  status TEXT NOT NULL,
  messages_found INT DEFAULT 0,
  messages_sent INT DEFAULT 0,
  error_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_heartbeats_account_created
  ON agent_heartbeats (ig_account_id, created_at DESC);


-- 5. Add instagram_handle column to artists (if not already present)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

CREATE INDEX IF NOT EXISTS idx_artists_instagram_handle
  ON artists (instagram_handle);


-- 6. Backfill: instagram_handle already exists on artists, no URL column to extract from.


-- 7. RLS policies — allow authenticated users full access
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pending_outbound_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON ig_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON agent_heartbeats FOR ALL USING (true) WITH CHECK (true);
