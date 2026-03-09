-- Atomic increment for emails_opened to avoid race conditions
-- when multiple webhook events fire concurrently for the same deal.
CREATE OR REPLACE FUNCTION public.increment_emails_opened(deal_id UUID)
RETURNS VOID AS $$
  UPDATE public.deals
  SET emails_opened = COALESCE(emails_opened, 0) + 1
  WHERE id = deal_id;
$$ LANGUAGE sql SECURITY DEFINER;
