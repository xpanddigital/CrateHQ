import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateBrandIdentity } from '@/lib/identity/generate-brand'
import { generateFbPersona } from '@/lib/identity/generate-fb-persona'
import { getCloudPhoneClient } from '@/lib/cloud-phones'
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

/**
 * POST /api/admin/aliases/generate
 *
 * Scout-onboarding accelerator. Two phases (see CLAUDE.md):
 *
 * Phase A (mode='phase_a') — runs once per scout. Generates the alias
 *   Facebook persona and operator checklist for the 21-day warm-up.
 *   Persists persona to scouts.fb_persona_json and flips scouts.fb_status to
 *   'warming' with warming_until = now+21d.
 *
 * Phase B (mode='phase_b') — runs 5-10 times per scout, only after the
 *   scout's fb_status='ready'. Generates a brand identity, inserts an
 *   account_identities row (without ig_account_id — operator will link it
 *   after creating the IG account on the new cloud phone), and returns the
 *   operator checklist.
 *
 * Request body:
 *   { scout_id: string, mode: 'phase_a' | 'phase_b', brief?: string, seed?: string }
 *
 * Response:
 *   Phase A: { phase: 'a', persona, checklist, warming_until }
 *   Phase B: { phase: 'b', brand, identity_id, checklist }
 */

const WARMING_DAYS_A = 21
const WARMING_DAYS_B_IG = 7

export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await userSupabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const rl = checkRateLimit(rateLimitKey(user.id, 'admin/aliases/generate'), RATE_LIMITS.ai)
    if (!rl.allowed) return rl.response

    const body = await request.json()
    const { scout_id, mode, brief, seed, force, operator_user_id } = body || {}

    if (!scout_id || typeof scout_id !== 'string') {
      return NextResponse.json({ error: 'scout_id is required' }, { status: 400 })
    }
    if (mode !== 'phase_a' && mode !== 'phase_b') {
      return NextResponse.json({ error: "mode must be 'phase_a' or 'phase_b'" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Look up scout + its account
    const { data: scout, error: scoutErr } = await supabase
      .from('scouts')
      .select('id, email, full_name, fb_status, warming_until, subscription_tier')
      .eq('id', scout_id)
      .maybeSingle()
    if (scoutErr || !scout) {
      return NextResponse.json({ error: 'Scout not found' }, { status: 404 })
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('scout_id', scout_id)
      .maybeSingle()
    if (!account) {
      return NextResponse.json(
        { error: 'Scout has no account row. Stripe webhook may not have completed.' },
        { status: 409 }
      )
    }

    if (mode === 'phase_a') {
      return await runPhaseA({ supabase, scout, account, seed, user, force })
    } else {
      return await runPhaseB({ supabase, scout, account, brief, user, force, operator_user_id })
    }
  } catch (e: any) {
    logger.error('[Aliases/Generate] Unhandled error:', e)
    return NextResponse.json({ error: e?.message ?? 'Internal server error' }, { status: 500 })
  }
}

type Ctx = {
  supabase: ReturnType<typeof createServiceClient>
  scout: any
  account: { id: string; name: string }
  user: { id: string }
  force?: boolean
}

async function runPhaseA(ctx: Ctx & { seed?: string }) {
  const { supabase, scout, account, user, seed, force } = ctx

  // Idempotency: if Phase A already ran and scout is warming/ready, refuse
  // unless caller explicitly passes force=true.
  if (!force && (scout.fb_status === 'warming' || scout.fb_status === 'ready')) {
    return NextResponse.json(
      {
        error: `Phase A already complete for this scout (fb_status='${scout.fb_status}')${scout.warming_until ? `, warming until ${scout.warming_until}` : ''}. Pass force=true to regenerate.`,
      },
      { status: 409 }
    )
  }

  const persona = await generateFbPersona({
    seed,
    accountId: account.id,
    userId: user.id,
  })

  const warmingUntil = new Date(Date.now() + WARMING_DAYS_A * 24 * 60 * 60 * 1000).toISOString()

  const { error: updErr } = await supabase
    .from('scouts')
    .update({
      fb_status: 'warming',
      warming_until: warmingUntil,
      fb_persona_json: persona,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scout.id)

  if (updErr) {
    logger.error('[Aliases/Generate Phase A] scout update failed:', updErr)
    return NextResponse.json({ error: 'Failed to persist persona' }, { status: 500 })
  }

  const checklist: string[] = [
    `Provision the scout's first cloud phone (GeeLark/BitBrowser, ~$40/mo). This will be the FB-creation device.`,
    `From that phone: create the Facebook account as "${persona.first_name} ${persona.last_name}" (DOB ${persona.birth_year}, ${persona.city}, ${persona.country}).`,
    `Complete SMS phone verification using the cloud phone's SIM.`,
    `Set occupation: ${persona.occupation}. Bio: "${persona.bio}".`,
    `Generate profile photo via /api/admin/generate-image with prompt: "${persona.profile_photo_prompt}". Upload to FB.`,
    `Generate cover photo with prompt: "${persona.cover_photo_prompt}". Upload to FB.`,
    `Record the security answers in 1Password (mother's maiden / first pet / childhood street) for recovery.`,
    `Run the FB warm-up script for 21 days: 2-3 sessions/wk of light activity (post, friend, like, join 2-3 groups). Do NOT create the Business Portfolio yet.`,
    `Auto-promotion to fb_status='ready' fires at ${warmingUntil}. After that, run Phase B (per-alias IG accounts).`,
  ]

  return NextResponse.json({
    phase: 'a',
    persona,
    warming_until: warmingUntil,
    checklist,
  })
}

async function runPhaseB(ctx: Ctx & { brief?: string; operator_user_id?: string }) {
  const { supabase, scout, account, user, brief, force, operator_user_id } = ctx

  // Gate: FB must be warmed up before spawning IG accounts. force=true skips
  // this check, but should only be used in testing.
  if (!force && scout.fb_status !== 'ready') {
    const remaining =
      scout.warming_until && scout.fb_status === 'warming'
        ? `still warming — ready at ${scout.warming_until}`
        : `fb_status='${scout.fb_status ?? 'null'}' — run Phase A first`
    return NextResponse.json(
      {
        error: `Cannot run Phase B: ${remaining}. Pass force=true to override (testing only).`,
      },
      { status: 409 }
    )
  }

  if (!brief || typeof brief !== 'string' || !brief.trim()) {
    return NextResponse.json({ error: 'brief is required for Phase B' }, { status: 400 })
  }

  // Pull existing alias names so we don't duplicate
  const { data: existing } = await supabase
    .from('account_identities')
    .select('display_name')
    .eq('account_id', account.id)
  const existingNames = (existing ?? []).map((r: any) => r.display_name).filter(Boolean)

  const brand = await generateBrandIdentity({
    brief: brief.trim(),
    existingNames,
    accountId: account.id,
    userId: user.id,
  })

  // Insert account_identities row. ig_account_id is null for now — the operator
  // will create the IG account on a fresh cloud phone and link it after.
  const { data: identity, error: insertErr } = await supabase
    .from('account_identities')
    .insert({
      account_id: account.id,
      ig_account_id: null,
      display_name: brand.display_name,
      theme_id: `alias-${Date.now()}`, // unique placeholder; operator can rename
      color_primary: brand.colors.primary,
      color_secondary: brand.colors.secondary,
      color_bg: brand.colors.bg,
      color_text: brand.colors.text,
      color_accent: brand.colors.accent,
      font_heading: brand.font_heading,
      font_body: brand.font_body,
      voice_prompt: brand.voice_prompt,
      caption_style: brand.caption_style,
      content_pillars: brand.content_pillars,
      image_styles: brand.image_styles,
      image_subjects: brand.image_subjects,
      hashtag_pool: brand.hashtag_pool,
      hashtags_per_post: brand.hashtags_per_post,
      posting_times: brand.posting_times,
      posting_days: brand.posting_days,
      posts_per_day: brand.posts_per_day,
      carousel_ratio: brand.carousel_ratio,
      ig_status: 'provisioning',
      warming_until: null,
    })
    .select('id')
    .single()

  if (insertErr) {
    logger.error('[Aliases/Generate Phase B] identity insert failed:', insertErr)
    return NextResponse.json({ error: 'Failed to save brand identity' }, { status: 500 })
  }

  const warmingUntil = new Date(Date.now() + WARMING_DAYS_B_IG * 24 * 60 * 60 * 1000).toISOString()

  // Auto-provision the cloud phone via GeeLark. Best-effort: if it fails
  // (env not configured, GeeLark API hiccup), Phase B still succeeds with
  // the brand identity saved. The checklist then includes a manual-provision
  // fallback step so the operator can still complete the alias.
  let provisionedProfileId: string | null = null
  let provisionedIgAccountId: string | null = null
  let provisionError: string | null = null
  try {
    const cloudPhone = getCloudPhoneClient('geelark')
    const phone = await cloudPhone.provisionPhone({
      label: `${account.name}-${brand.display_name}`,
    })
    provisionedProfileId = phone.profileId

    const igAccountId = crypto.randomUUID()
    const webhookSecret = crypto.randomBytes(24).toString('hex')
    const placeholderUsername = `pending-${igAccountId.slice(0, 12)}`

    const { error: igErr } = await supabase.from('ig_accounts').insert({
      id: igAccountId,
      account_id: account.id,
      ig_username: placeholderUsername,
      webhook_secret: webhookSecret,
      cloud_phone_provider: 'geelark',
      cloud_phone_profile_id: phone.profileId,
      operator_user_id: operator_user_id ?? null,
      provisioned_at: new Date().toISOString(),
      is_active: false,
    })
    if (igErr) {
      // Phone is live but our row failed; surface so admin can reconcile.
      throw new Error(`ig_accounts insert failed: ${igErr.message}`)
    }
    provisionedIgAccountId = igAccountId

    await supabase
      .from('account_identities')
      .update({
        ig_account_id: igAccountId,
        cloud_phone_id: phone.profileId,
      })
      .eq('id', identity.id)
  } catch (e: unknown) {
    provisionError = e instanceof Error ? e.message : String(e)
    logger.error('[Aliases/Generate Phase B] cloud phone provision failed:', e)
  }

  const checklist: string[] = []
  if (provisionedProfileId) {
    checklist.push(
      `Cloud phone provisioned in GeeLark (profile: ${provisionedProfileId}). Open it from /operator/phones to complete the next steps on-device.`
    )
    checklist.push(
      `From the scout's alias FB account (on the original cloud phone): create a Facebook Page named "${brand.display_name}" inside the Business Portfolio.`
    )
    checklist.push(
      `From the NEW cloud phone (logged into the alias FB): create the Instagram Business account, set bio to "${brand.persona_bio}", link to the FB Page.`
    )
    checklist.push(
      `Update ig_accounts row ${provisionedIgAccountId} with the real ig_username once the IG account is created (replace the placeholder).`
    )
  } else {
    checklist.push(
      `⚠️ Cloud phone auto-provisioning failed: ${provisionError}. Provision a phone manually in GeeLark, then POST /api/admin/cloud-phones/provision to register it, then link to this identity (id=${identity.id}).`
    )
    checklist.push(
      `From the scout's alias FB account: create a Facebook Page named "${brand.display_name}" inside the Business Portfolio.`
    )
    checklist.push(
      `From the new cloud phone: create the Instagram Business account, set bio to "${brand.persona_bio}", link to the FB Page.`
    )
  }
  checklist.push(
    `Create a GHL sub-account named "${brand.display_name}". Install the Praecora marketplace app on it.`
  )
  checklist.push(
    `Run the 7-day IG warm-up: light scrolling + 1-2 organic likes/day, no DMs. Auto-promotion to ig_status='ready' fires at ${warmingUntil}.`
  )
  checklist.push(
    `Brand persona, voice, colors, hashtags, posting schedule are already saved on identity row ${identity.id}.`
  )
  checklist.push(
    `Content Studio is unlocked for this identity — Joel can generate the first 30 days of posts immediately.`
  )

  return NextResponse.json({
    phase: 'b',
    brand,
    identity_id: identity.id,
    ig_account_id: provisionedIgAccountId,
    cloud_phone_profile_id: provisionedProfileId,
    cloud_phone_provision_error: provisionError,
    warming_until_target: warmingUntil,
    checklist,
  })
}
