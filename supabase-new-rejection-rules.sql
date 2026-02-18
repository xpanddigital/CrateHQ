-- New email rejection rules — run after the original supabase-email-rejection-rules.sql
-- These are additive; they won't conflict with existing rules.

INSERT INTO email_rejection_rules (rule_type, pattern, reason) VALUES
-- Placeholders
('exact', 'realhuman@email.com', 'Fake placeholder email'),
-- Platforms (not artist contacts)
('exact', 'info@wikimedia.org', 'Wikipedia — not artist contact'),
('exact', 'info@viberate.com', 'Music analytics platform — not artist'),
('exact', 'info@ticketweb.com', 'Ticketing platform — not artist'),
-- Merch stores / fulfillment
('domain', 'emeraldfulfillment.com', 'Merch fulfillment platform'),
('domain', 'bravadostores.com', 'Merch fulfillment platform'),
-- Warner Music short domain
('domain', 'wm.com', 'Warner Music corporate (short domain)'),
-- Platform domains
('domain', 'wikimedia.org', 'Wikipedia — not artist contact'),
('domain', 'viberate.com', 'Music analytics platform'),
('domain', 'ticketweb.com', 'Ticketing platform')
ON CONFLICT DO NOTHING;
