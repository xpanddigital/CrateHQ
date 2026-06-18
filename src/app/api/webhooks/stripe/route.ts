import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/service'
import { sendOpsAlert } from '@/lib/email/resend'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stripe webhook receiver.
 *
 * Verifies the Stripe-Signature header against STRIPE_WEBHOOK_SECRET, then
 * processes events idempotently. We persist every event in `stripe_events`
 * keyed by event.id; on conflict we treat it as already-processed and
 * ack 200 (Stripe retries on non-200).
 *
 * Events we care about:
 *   - checkout.session.completed     → upsert scout + account, record onboarding charge
 *   - invoice.payment_succeeded      → record recurring charge, clear past_due
 *   - invoice.payment_failed         → past_due (if retries exhausted) + alert
 *   - customer.subscription.updated  → reflect plan/billing-cycle changes
 *   - customer.subscription.deleted  → mark scout cancelled
 *   - charge.refunded                → record negative ledger entry (commission accuracy)
 *
 * Everything else is logged + acked.
 */
export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    logger.warn('[Stripe Webhook] Missing signature or secret')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret)
  } catch (err: any) {
    logger.error('[Stripe Webhook] Signature verification failed:', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Idempotency: insert event row first. Unique on event_id → duplicate replays no-op.
  const { error: insertErr } = await supabase.from('stripe_events').insert({
    event_id: event.id,
    type: event.type,
    livemode: event.livemode,
    payload: event as unknown as Record<string, unknown>,
  })
  if (insertErr) {
    if (insertErr.code === '23505') {
      // duplicate — already processed
      return NextResponse.json({ received: true, duplicate: true })
    }
    logger.error('[Stripe Webhook] stripe_events insert failed:', insertErr)
    // Fall through and still try to process — but log it.
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, supabase)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event, supabase)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event, supabase)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, supabase)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, supabase)
        break
      case 'charge.refunded':
        await handleChargeRefunded(event, supabase)
        break
      default:
        logger.info('[Stripe Webhook] Unhandled event type', { type: event.type })
    }
  } catch (err: any) {
    logger.error('[Stripe Webhook] Handler failed:', err)
    // Persist the error so we can replay manually. Still ack 200 — we don't
    // want Stripe to retry indefinitely if the bug is in our handler.
    await supabase
      .from('stripe_events')
      .update({ error: err?.message ?? String(err) })
      .eq('event_id', event.id)
  }

  return NextResponse.json({ received: true })
}

type ServiceClient = ReturnType<typeof createServiceClient>

async function resolvePartnerId(
  supabase: ServiceClient,
  ref: string | null | undefined
): Promise<string | null> {
  if (!ref) return null
  const slug = ref.trim().toLowerCase()
  if (!slug) return null
  const { data } = await supabase
    .from('partners')
    .select('id, commission_rate')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data?.id ?? null
}

async function getPartnerSnapshot(
  supabase: ServiceClient,
  partnerId: string | null
): Promise<{ id: string; rate: number } | null> {
  if (!partnerId) return null
  const { data } = await supabase
    .from('partners')
    .select('id, commission_rate')
    .eq('id', partnerId)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, rate: Number(data.commission_rate) }
}

async function handleCheckoutCompleted(event: Stripe.Event, supabase: ServiceClient) {
  const session = event.data.object as Stripe.Checkout.Session

  // We only care about our onboarding payments (mode=payment). Subscriptions
  // (if we ever flip to mode=subscription) are handled by invoice.* events.
  if (session.mode !== 'payment') {
    logger.info('[Stripe Webhook] checkout.session.completed ignored (non-payment mode)', {
      session_id: session.id,
      mode: session.mode,
    })
    return
  }
  if (session.payment_status !== 'paid') {
    logger.warn('[Stripe Webhook] checkout.session.completed but not paid', {
      session_id: session.id,
      status: session.payment_status,
    })
    return
  }

  const tier = session.metadata?.praecora_tier as string | undefined
  const billingCycle = session.metadata?.billing_cycle as string | undefined
  const ref = (session.metadata?.ref as string | undefined) || null

  if (!tier || !billingCycle) {
    logger.warn('[Stripe Webhook] Session missing metadata', {
      session_id: session.id,
      metadata: session.metadata,
    })
    return
  }
  if (!['starter', 'growth', 'pro', 'whale'].includes(tier)) return
  if (!['monthly', 'annual'].includes(billingCycle)) return

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  const email = session.customer_details?.email ?? session.customer_email ?? null
  const fullName = session.customer_details?.name ?? null

  if (!customerId || !email) {
    logger.warn('[Stripe Webhook] Missing customer/email on session', {
      session_id: session.id,
    })
    return
  }

  const partnerId = await resolvePartnerId(supabase, ref)
  const partnerSnapshot = await getPartnerSnapshot(supabase, partnerId)
  const now = new Date().toISOString()

  // Upsert scout by stripe_customer_id
  const { data: scout, error: upsertErr } = await supabase
    .from('scouts')
    .upsert(
      {
        email,
        full_name: fullName,
        stripe_customer_id: customerId,
        subscription_tier: tier,
        billing_cycle: billingCycle,
        status: 'onboarding',
        onboarding_paid_at: now,
        commission_partner_id: partnerId,
        referral_code: ref,
      },
      { onConflict: 'stripe_customer_id' }
    )
    .select('id')
    .single()

  if (upsertErr) {
    logger.error('[Stripe Webhook] scout upsert failed:', upsertErr)
    throw upsertErr
  }

  // Create the account (tenant) for this scout if one doesn't exist yet.
  // The account_member row gets added at signup time by the
  // link_profile_to_scout_account trigger — at this point we don't yet have
  // a profile id (the user hasn't signed up).
  const { error: accountErr } = await supabase
    .from('accounts')
    .upsert(
      {
        name: fullName ?? email,
        scout_id: scout.id,
      },
      { onConflict: 'scout_id' }
    )
  if (accountErr) {
    logger.error('[Stripe Webhook] account upsert failed:', accountErr)
    // Don't throw — the scout row succeeded, the account can be created later
    // by /api/scouts when the admin invites this user.
  }

  // Record charge for commission ledger
  const amountTotal = session.amount_total ?? 0
  const piId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  const { error: chargeErr } = await supabase.from('scout_charges').insert({
    scout_id: scout.id,
    stripe_event_id: event.id,
    stripe_payment_intent_id: piId,
    kind: 'onboarding',
    amount_cents: amountTotal,
    currency: session.currency ?? 'usd',
    occurred_at: now,
    commission_partner_id: partnerSnapshot?.id ?? null,
    commission_rate: partnerSnapshot?.rate ?? null,
  })
  if (chargeErr && chargeErr.code !== '23505') {
    logger.error('[Stripe Webhook] scout_charges insert failed:', chargeErr)
  }

  // Link event to scout for audit
  await supabase
    .from('stripe_events')
    .update({ related_scout_id: scout.id })
    .eq('event_id', event.id)

  logger.info('[Stripe Webhook] Onboarding paid', {
    scout_id: scout.id,
    tier,
    billing_cycle: billingCycle,
    ref,
    amount_cents: amountTotal,
  })

  // Ops alert — non-blocking
  await sendOpsAlert({
    subject: `New Praecora signup — ${tier} (${ref || 'no ref'})`,
    html: `
      <h2>New scout signed up</h2>
      <p><strong>Tier:</strong> ${tier}</p>
      <p><strong>Billing cycle:</strong> ${billingCycle}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Name:</strong> ${fullName ?? '—'}</p>
      <p><strong>Referral:</strong> ${ref || '—'}</p>
      <p><strong>Onboarding paid:</strong> $${(amountTotal / 100).toFixed(2)}</p>
      <p><strong>Stripe customer:</strong> <code>${customerId}</code></p>
      <p><strong>Scout ID:</strong> <code>${scout.id}</code></p>
      <hr/>
      <p>Next step in ~4 weeks: mark this scout live in <a href="https://praecora.com/admin/scouts">/admin/scouts</a> to start their recurring billing.</p>
    `,
  })
}

async function handleInvoicePaid(event: Stripe.Event, supabase: ServiceClient) {
  const invoice = event.data.object as Stripe.Invoice
  // Only recurring subscription invoices — skip $0 / one-off invoices that don't
  // belong to a subscription.
  // Stripe types use `(invoice as any).subscription` — the field is on the API
  // but not on all SDK type variants.
  const subscriptionId =
    typeof (invoice as any).subscription === 'string'
      ? ((invoice as any).subscription as string)
      : ((invoice as any).subscription?.id as string | undefined) ?? null
  if (!subscriptionId) return

  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  if (!customerId) return

  const { data: scout } = await supabase
    .from('scouts')
    .select('id, status, commission_partner_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (!scout) {
    logger.warn('[Stripe Webhook] invoice.payment_succeeded but no matching scout', {
      customer: customerId,
    })
    return
  }

  const partnerSnapshot = await getPartnerSnapshot(supabase, scout.commission_partner_id)

  await supabase.from('scout_charges').insert({
    scout_id: scout.id,
    stripe_event_id: event.id,
    stripe_invoice_id: invoice.id,
    kind: 'subscription',
    amount_cents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? 'usd',
    occurred_at: new Date().toISOString(),
    commission_partner_id: partnerSnapshot?.id ?? null,
    commission_rate: partnerSnapshot?.rate ?? null,
  })

  // Successful payment heals a past_due account.
  if (scout.status === 'past_due') {
    await supabase
      .from('scouts')
      .update({ status: 'live', past_due_at: null })
      .eq('id', scout.id)
  }

  await supabase
    .from('stripe_events')
    .update({ related_scout_id: scout.id })
    .eq('event_id', event.id)
}

async function handleInvoiceFailed(event: Stripe.Event, supabase: ServiceClient) {
  const invoice = event.data.object as Stripe.Invoice
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  if (!customerId) return
  const { data: scout } = await supabase
    .from('scouts')
    .select('id, email, subscription_tier, status')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (!scout) return
  logger.error('[Stripe Webhook] Invoice payment failed', {
    scout_id: scout.id,
    email: scout.email,
    tier: scout.subscription_tier,
    invoice_id: invoice.id,
    amount_due: invoice.amount_due,
    next_attempt: invoice.next_payment_attempt,
  })
  await supabase
    .from('stripe_events')
    .update({ related_scout_id: scout.id })
    .eq('event_id', event.id)

  // Stripe sets next_payment_attempt = null when smart retries are exhausted.
  // At that point flip to past_due — dashboard layout will gate access.
  const retriesExhausted = !invoice.next_payment_attempt
  if (retriesExhausted && scout.status === 'live') {
    await supabase
      .from('scouts')
      .update({ status: 'past_due', past_due_at: new Date().toISOString() })
      .eq('id', scout.id)
    logger.warn('[Stripe Webhook] Scout flipped to past_due', { scout_id: scout.id })
  }

  await sendOpsAlert({
    subject: `Praecora payment FAILED — ${scout.email} (${scout.subscription_tier})${retriesExhausted ? ' — RETRIES EXHAUSTED' : ''}`,
    html: `
      <h2>Invoice payment failed</h2>
      <p><strong>Scout email:</strong> ${scout.email}</p>
      <p><strong>Tier:</strong> ${scout.subscription_tier}</p>
      <p><strong>Amount due:</strong> $${((invoice.amount_due ?? 0) / 100).toFixed(2)}</p>
      <p><strong>Invoice:</strong> <code>${invoice.id}</code></p>
      <p><strong>Scout ID:</strong> <code>${scout.id}</code></p>
      <p><strong>Next Stripe retry:</strong> ${invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : '<strong>NONE — retries exhausted, scout flipped to past_due, dashboard access blocked</strong>'}</p>
      <hr/>
      <p>${retriesExhausted ? 'Reach out to this scout immediately to update their card.' : 'Stripe will retry automatically. Check the customer in the Stripe dashboard and follow up if it persists.'}</p>
    `,
  })
}

async function handleSubscriptionUpdated(event: Stripe.Event, supabase: ServiceClient) {
  const sub = event.data.object as Stripe.Subscription
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
  if (!customerId) return
  const { data: scout } = await supabase
    .from('scouts')
    .select('id, subscription_tier, billing_cycle')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (!scout) return

  // Pull tier / cycle from the subscription's first item. We don't auto-mutate
  // the scout row unless metadata explicitly mirrors a known tier — plan IDs
  // change between Stripe accounts and we don't want to blow away the
  // canonical billing_cycle the scout signed up on.
  const newTier = sub.metadata?.praecora_tier
  const newCycle = sub.metadata?.billing_cycle
  const update: Record<string, any> = {}
  if (newTier && ['starter','growth','pro','whale'].includes(newTier) && newTier !== scout.subscription_tier) {
    update.subscription_tier = newTier
  }
  if (newCycle && ['monthly','annual'].includes(newCycle) && newCycle !== scout.billing_cycle) {
    update.billing_cycle = newCycle
  }
  if (sub.cancel_at_period_end) {
    // Don't mark cancelled yet — the actual subscription.deleted event will
    // fire at period end. Just flag for ops visibility.
    logger.info('[Stripe Webhook] Subscription set to cancel at period end', { scout_id: scout.id, cancel_at: sub.cancel_at })
  }

  if (Object.keys(update).length > 0) {
    await supabase.from('scouts').update(update).eq('id', scout.id)
    logger.info('[Stripe Webhook] Subscription updated', { scout_id: scout.id, ...update })
  }

  await supabase
    .from('stripe_events')
    .update({ related_scout_id: scout.id })
    .eq('event_id', event.id)
}

async function handleChargeRefunded(event: Stripe.Event, supabase: ServiceClient) {
  const charge = event.data.object as Stripe.Charge
  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? null
  if (!customerId) return

  const { data: scout } = await supabase
    .from('scouts')
    .select('id, commission_partner_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (!scout) {
    logger.warn('[Stripe Webhook] charge.refunded but no matching scout', { customer: customerId })
    return
  }

  // amount_refunded covers full + partial refunds. Stored as a NEGATIVE
  // amount_cents so the partner-commission ledger (which sums charges) nets
  // correctly. Each refund event gets its own row keyed by event.id so
  // multiple partial refunds against one charge stay distinct.
  const refundCents = -1 * (charge.amount_refunded ?? 0)
  if (refundCents === 0) return

  const partnerSnapshot = await getPartnerSnapshot(supabase, scout.commission_partner_id)

  const { error: chargeErr } = await supabase.from('scout_charges').insert({
    scout_id: scout.id,
    stripe_event_id: event.id,
    stripe_payment_intent_id: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null,
    kind: 'refund',
    amount_cents: refundCents,
    currency: charge.currency ?? 'usd',
    occurred_at: new Date().toISOString(),
    commission_partner_id: partnerSnapshot?.id ?? null,
    commission_rate: partnerSnapshot?.rate ?? null,
  })
  if (chargeErr && chargeErr.code !== '23505') {
    logger.error('[Stripe Webhook] refund ledger insert failed:', chargeErr)
  }

  // Optional: flag scout as refunded if FULL refund of the most recent charge
  if (charge.amount_refunded === charge.amount && charge.amount > 0) {
    await supabase
      .from('scouts')
      .update({ status: 'refunded' })
      .eq('id', scout.id)
      .in('status', ['onboarding', 'live', 'past_due']) // don't downgrade from cancelled
  }

  await supabase
    .from('stripe_events')
    .update({ related_scout_id: scout.id })
    .eq('event_id', event.id)

  logger.info('[Stripe Webhook] Refund recorded', { scout_id: scout.id, refund_cents: refundCents })
}

async function handleSubscriptionDeleted(event: Stripe.Event, supabase: ServiceClient) {
  const sub = event.data.object as Stripe.Subscription
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
  if (!customerId) return
  const { data: scout } = await supabase
    .from('scouts')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (!scout) return
  await supabase
    .from('scouts')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', scout.id)
  await supabase
    .from('stripe_events')
    .update({ related_scout_id: scout.id })
    .eq('event_id', event.id)
}
