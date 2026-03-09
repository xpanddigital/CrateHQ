import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import type { SequenceStep } from '@/types/database'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null as any, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { user: null as any, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { user, error: null }
}

/**
 * POST /api/sequences/enroll — Bulk enroll artists into a sequence
 */
export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      artist_ids,
      template_id,
      ig_account_id,
      scout_id,
      generate_dm_now,
    } = body

    if (!Array.isArray(artist_ids) || artist_ids.length === 0) {
      return NextResponse.json({ error: 'artist_ids must be a non-empty array' }, { status: 400 })
    }
    if (!template_id || !ig_account_id) {
      return NextResponse.json({ error: 'template_id and ig_account_id are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('sequence_templates')
      .select('*')
      .eq('id', template_id)
      .eq('is_active', true)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found or inactive' }, { status: 404 })
    }

    const steps = template.steps as SequenceStep[]
    if (!steps || steps.length === 0) {
      return NextResponse.json({ error: 'Template has no steps' }, { status: 400 })
    }

    // Verify IG account exists
    const { data: igAccount, error: igError } = await supabase
      .from('ig_accounts')
      .select('id, is_active')
      .eq('id', ig_account_id)
      .single()

    if (igError || !igAccount) {
      return NextResponse.json({ error: 'IG account not found' }, { status: 404 })
    }

    // Fetch all artists
    const { data: artists, error: artistsError } = await supabase
      .from('artists')
      .select('id, name, instagram_handle, biography, spotify_monthly_listeners, genres, estimated_offer_low, estimated_offer_high')
      .in('id', artist_ids)

    if (artistsError) {
      logger.error('[Sequences/Enroll] Artists fetch error:', artistsError)
      return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
    }

    // Check if template has a send_dm step
    const hasDmStep = steps.some(s => s.actions.some(a => a.type === 'send_dm'))

    // Pre-generate DM text if requested
    let anthropicClient: Anthropic | null = null
    if (generate_dm_now && hasDmStep && process.env.ANTHROPIC_API_KEY) {
      anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    }

    const resolvedScoutId = scout_id || user.id
    const results = {
      enrolled: 0,
      skipped: 0,
      skipped_reasons: [] as string[],
      deals_created: 0,
      errors: [] as string[],
    }

    for (const artist of (artists || [])) {
      // Skip if no instagram handle
      if (!artist.instagram_handle) {
        results.skipped++
        results.skipped_reasons.push(`${artist.name}: no instagram_handle`)
        continue
      }

      // Calculate next_step_at with ± 2hr jitter
      const firstStepOffset = steps[0].day_offset
      const jitterMs = (Math.random() * 4 - 2) * 60 * 60 * 1000 // ±2 hours
      const nextStepAt = new Date(Date.now() + firstStepOffset * 24 * 60 * 60 * 1000 + jitterMs)

      // Pre-generate DM if requested
      let dmMessageText: string | null = null
      if (anthropicClient && hasDmStep) {
        try {
          const prompt = `Write a short, casual Instagram DM from a music industry scout to ${artist.name || 'an artist'}. Mention their ${(artist.genres || []).join(', ') || 'music'} and that you can offer around ${artist.estimated_offer_low ? `$${Math.round(artist.estimated_offer_low / 1000)}k` : 'a competitive amount'} to ${artist.estimated_offer_high ? `$${Math.round(artist.estimated_offer_high / 1000)}k` : 'a competitive amount'} for a short-term back catalogue distribution deal. Keep it 3-5 sentences, no em dashes, casual tone. Start with "Hey ${artist.name || 'there'}!"`.trim()

          const resp = await anthropicClient.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 150,
            messages: [{ role: 'user', content: prompt }],
          })
          dmMessageText = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : null
        } catch (aiErr) {
          logger.error(`[Sequences/Enroll] DM generation failed for ${artist.name}:`, aiErr)
          // Continue without DM text — can be generated later by scheduler
        }
      }

      // Insert enrollment (partial unique index prevents duplicates)
      const { error: enrollError } = await supabase
        .from('sequence_enrollments')
        .insert({
          artist_id: artist.id,
          template_id,
          ig_account_id,
          scout_id: resolvedScoutId,
          current_step: 1,
          total_steps: steps.length,
          next_step_at: nextStepAt.toISOString(),
          status: 'active',
          dm_message_text: dmMessageText,
        })

      if (enrollError) {
        if (enrollError.code === '23505') {
          // Unique constraint violation — active enrollment already exists
          results.skipped++
          results.skipped_reasons.push(`${artist.name}: already enrolled (active)`)
        } else {
          logger.error(`[Sequences/Enroll] Insert error for ${artist.name}:`, enrollError)
          results.errors.push(`${artist.name}: ${enrollError.message}`)
        }
        continue
      }

      results.enrolled++

      // Create deal at outreach_queued if none exists
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('id')
        .eq('artist_id', artist.id)
        .maybeSingle()

      if (!existingDeal) {
        const { error: dealError } = await supabase
          .from('deals')
          .insert({
            artist_id: artist.id,
            scout_id: resolvedScoutId,
            stage: 'outreach_queued',
            outreach_channel: 'instagram',
            estimated_deal_value: artist.estimated_offer_low || null,
          })

        if (dealError) {
          logger.error(`[Sequences/Enroll] Deal create error for ${artist.name}:`, dealError)
          // Don't fail the enrollment — deal can be created manually
        } else {
          results.deals_created++
        }
      }
    }

    // Check for artist_ids that weren't found in the DB
    const foundIds = new Set((artists || []).map(a => a.id))
    for (const id of artist_ids) {
      if (!foundIds.has(id)) {
        results.skipped++
        results.skipped_reasons.push(`${id}: artist not found`)
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    logger.error('[Sequences/Enroll] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
