-- Content Engine schema for Flank (formerly CrateHQ)
-- Run this in the Supabase SQL editor against your existing database.

-- 1. Knowledge bases for long-form brand/context documents
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  source_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Account identities (visual + voice profiles) per IG account
CREATE TABLE IF NOT EXISTS account_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id TEXT REFERENCES ig_accounts(id),
  display_name TEXT NOT NULL,
  knowledge_base_id UUID REFERENCES knowledge_bases(id),
  -- VISUAL IDENTITY
  theme_id TEXT NOT NULL,
  color_primary TEXT NOT NULL,
  color_secondary TEXT NOT NULL,
  color_bg TEXT NOT NULL,
  color_text TEXT NOT NULL,
  color_accent TEXT NOT NULL,
  font_heading TEXT NOT NULL,
  font_body TEXT NOT NULL,
  carousel_style JSONB NOT NULL DEFAULT '{}',
  -- VOICE & TONE
  voice_prompt TEXT NOT NULL,
  caption_style TEXT NOT NULL,
  content_pillars TEXT[] NOT NULL,
  -- IMAGE GENERATION
  image_styles TEXT[] NOT NULL,
  image_subjects TEXT[] NOT NULL,
  -- POSTING
  posting_times TEXT[] NOT NULL,
  posting_days TEXT[] NOT NULL,
  posts_per_day INTEGER DEFAULT 2,
  carousel_ratio FLOAT DEFAULT 0.6,
  -- HASHTAGS
  hashtag_pool TEXT[] NOT NULL,
  hashtags_per_post INTEGER DEFAULT 10,
  -- META
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Generated posts
CREATE TABLE IF NOT EXISTS content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id TEXT REFERENCES ig_accounts(id),
  identity_id UUID REFERENCES account_identities(id),
  post_type TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  -- CAROUSEL
  slides JSONB,
  slide_image_urls TEXT[],
  -- SINGLE IMAGE
  nano_prompt TEXT,
  image_url TEXT,
  alt_prompts TEXT[],
  -- SCHEDULING
  scheduled_date DATE,
  scheduled_time TIME,
  ghl_post_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Topics for grouping posts / ideas
CREATE TABLE IF NOT EXISTS content_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  ig_account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topic_hash ON content_topics(topic_hash);

-- 5. Extend existing tables
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS ghl_location_id TEXT;
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS ghl_social_account_id TEXT;
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS ghl_api_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'scout';

-- 6. Promote a user to admin (optional; replace WHERE clause with your user)
-- UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM profiles LIMIT 1);

