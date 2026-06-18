import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for the logged-in scout. Returns
 * the portal URL the caller should redirect to. Lets the customer manage
 * their card, view invoices, cancel subscription, etc. without any
 * support touch.
 *
 * Requires the scout to have a stripe_customer_id (set by the Stripe webhook
 * on checkout.session.completed).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit(rateLimitKey(user.id, 'billing/portal'), RATE_LIMITS.standard)
    if (!rl.allowed) return rl.response

    // Look up the scout's Stripe customer via the linked profile_id
    const { data: scout, error } = await supabase
      .from('scouts')
      .select('stripe_customer_id, email')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (error) {
      logger.error('[Billing Portal] scouts lookup failed:', error)
      return NextResponse.json({ error: 'Failed to look up billing record' }, { status: 500 })
    }
    if (!scout?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer on file. Reach out to support if you believe this is an error.' },
        { status: 404 }
      )
    }

    const origin = request.nextUrl.origin
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: scout.stripe_customer_id,
      return_url: `${origin}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    logger.error('[Billing Portal] Unhandled error:', e)
    return NextResponse.json(
      { error: e?.message ?? 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}
