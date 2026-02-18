-- Email rejection rules — creates table if needed, then seeds all rules.
-- Safe to run multiple times (IF NOT EXISTS + ON CONFLICT).

CREATE TABLE IF NOT EXISTS public.email_rejection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rule_type, pattern)
);

ALTER TABLE email_rejection_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON email_rejection_rules;
CREATE POLICY "auth_all" ON email_rejection_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Exact matches
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('exact', 'user@domain.com', 'Placeholder email'),
('exact', 'privacypolicy@wmg.com', 'Warner Music privacy inbox'),
('exact', 'email@email.com', 'Placeholder email'),
('exact', 'realhuman@email.com', 'Fake placeholder email'),
('exact', 'info@wikimedia.org', 'Wikipedia — not artist contact'),
('exact', 'info@viberate.com', 'Music analytics platform — not artist'),
('exact', 'info@ticketweb.com', 'Ticketing platform — not artist')
ON CONFLICT (rule_type, pattern) DO NOTHING;

-- Domain-level rejections
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('domain', 'wmg.com', 'Warner Music Group corporate'),
('domain', 'wm.com', 'Warner Music corporate (short domain)'),
('domain', 'umgstores.com', 'Universal merch store'),
('domain', 'kontrabandstores.com', 'Merch fulfillment platform'),
('domain', 'sonymusic.com', 'Sony Music corporate'),
('domain', 'umusic.com', 'Universal Music corporate'),
('domain', 'universalmusic.com', 'Universal Music corporate'),
('domain', 'warnerrecords.com', 'Warner Records corporate'),
('domain', 'emeraldfulfillment.com', 'Merch fulfillment platform'),
('domain', 'bravadostores.com', 'Merch fulfillment platform'),
('domain', 'merchbar.com', 'Merch platform'),
('domain', 'shopify.com', 'E-commerce platform'),
('domain', 'bigcartel.com', 'Merch platform'),
('domain', 'bandmerch.com', 'Merch platform'),
('domain', 'wikimedia.org', 'Wikipedia — not artist contact'),
('domain', 'viberate.com', 'Music analytics platform'),
('domain', 'ticketweb.com', 'Ticketing platform'),
('domain', 'example.com', 'Placeholder domain'),
('domain', 'test.com', 'Placeholder domain'),
('domain', 'domain.com', 'Placeholder domain')
ON CONFLICT (rule_type, pattern) DO NOTHING;

-- Prefix-level rejections
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('prefix', 'privacypolicy@', 'Privacy policy inbox'),
('prefix', 'privacy@', 'Privacy inbox'),
('prefix', 'customerservice@', 'Customer service inbox'),
('prefix', 'customer.service@', 'Customer service inbox'),
('prefix', 'noreply@', 'No-reply inbox'),
('prefix', 'no-reply@', 'No-reply inbox'),
('prefix', 'donotreply@', 'Do not reply inbox'),
('prefix', 'do-not-reply@', 'Do not reply inbox'),
('prefix', 'test@', 'Test email'),
('prefix', 'example@', 'Example email'),
('prefix', 'postmaster@', 'Postmaster inbox'),
('prefix', 'webmaster@', 'Webmaster inbox'),
('prefix', 'mailer-daemon@', 'Mailer daemon'),
('prefix', 'abuse@', 'Abuse inbox'),
('prefix', 'dmca@', 'DMCA inbox'),
('prefix', 'legal@', 'Legal inbox'),
('prefix', 'compliance@', 'Compliance inbox')
ON CONFLICT (rule_type, pattern) DO NOTHING;

-- Domain keyword rejections
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('keyword_domain', 'merch', 'Merch store domain'),
('keyword_domain', 'store', 'Store domain'),
('keyword_domain', 'shop', 'Shop domain'),
('keyword_domain', 'apparel', 'Apparel store domain'),
('keyword_domain', 'fulfillment', 'Fulfillment platform')
ON CONFLICT (rule_type, pattern) DO NOTHING;

-- Local part keyword rejections
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('keyword_local', 'sales', 'Sales inbox'),
('keyword_local', 'billing', 'Billing inbox'),
('keyword_local', 'webmaster', 'Webmaster inbox'),
('keyword_local', 'postmaster', 'Postmaster inbox')
ON CONFLICT (rule_type, pattern) DO NOTHING;
