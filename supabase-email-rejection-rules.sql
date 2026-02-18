-- Email rejection rules — configurable patterns for the email quality filter.
-- Add new rules here without code changes. The enrichment pipeline checks these.

CREATE TABLE IF NOT EXISTS public.email_rejection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL, -- 'exact', 'domain', 'prefix', 'keyword_domain', 'keyword_local'
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_rejection_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON email_rejection_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with known junk patterns from real enrichment data

-- Exact matches
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('exact', 'user@domain.com', 'Placeholder email'),
('exact', 'privacypolicy@wmg.com', 'Warner Music privacy inbox'),
('exact', 'email@email.com', 'Placeholder email');

-- Domain-level rejections
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('domain', 'wmg.com', 'Warner Music Group corporate'),
('domain', 'umgstores.com', 'Universal merch store'),
('domain', 'kontrabandstores.com', 'Merch fulfillment platform'),
('domain', 'sonymusic.com', 'Sony Music corporate'),
('domain', 'umusic.com', 'Universal Music corporate'),
('domain', 'universalmusic.com', 'Universal Music corporate'),
('domain', 'warnerrecords.com', 'Warner Records corporate'),
('domain', 'merchbar.com', 'Merch platform'),
('domain', 'shopify.com', 'E-commerce platform'),
('domain', 'bigcartel.com', 'Merch platform'),
('domain', 'bandmerch.com', 'Merch platform'),
('domain', 'example.com', 'Placeholder domain'),
('domain', 'test.com', 'Placeholder domain'),
('domain', 'domain.com', 'Placeholder domain');

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
('prefix', 'compliance@', 'Compliance inbox');

-- Domain keyword rejections
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('keyword_domain', 'merch', 'Merch store domain'),
('keyword_domain', 'store', 'Store domain'),
('keyword_domain', 'shop', 'Shop domain'),
('keyword_domain', 'apparel', 'Apparel store domain'),
('keyword_domain', 'fulfillment', 'Fulfillment platform');

-- Local part keyword rejections
INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
('keyword_local', 'sales', 'Sales inbox'),
('keyword_local', 'billing', 'Billing inbox'),
('keyword_local', 'webmaster', 'Webmaster inbox'),
('keyword_local', 'postmaster', 'Postmaster inbox');
