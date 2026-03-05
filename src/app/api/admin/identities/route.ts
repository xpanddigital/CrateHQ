import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { supabase, user, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { supabase, user, error: null }
}

export async function GET() {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const { data: identitiesRaw, error: idError } = await supabase
      .from('account_identities')
      .select('*')
      .order('created_at', { ascending: true })

    if (idError) {
      console.error('[Admin/Identities] Fetch identities error:', idError)
      // Table may not exist yet (Content Engine migration not run); return empty so page still loads
      if (idError.code === '42P01' || idError.message?.includes('does not exist')) {
        const { data: accountsOnly, error: accErr } = await supabase
          .from('ig_accounts')
          .select('id, ig_username')
          .order('created_at', { ascending: true })
        if (accErr) {
          return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
        }
        return NextResponse.json({
          identities: [],
          available_accounts: (accountsOnly || []).map((a: any) => ({ ...a, ghl_location_id: null, ghl_social_account_id: null, ghl_api_key: null })),
        })
      }
      return NextResponse.json({ error: 'Failed to fetch identities' }, { status: 500 })
    }

    const identities = identitiesRaw || []

    // Select only columns that exist in base schema; ghl_* may be missing if Content Engine migration not run
    const { data: accounts, error: accError } = await supabase
      .from('ig_accounts')
      .select('id, ig_username')
      .order('created_at', { ascending: true })

    if (accError) {
      console.error('[Admin/Identities] Fetch accounts error:', accError)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    // Optionally fetch GHL columns if they exist (Content Engine migration adds them)
    let ghlByAccountId: Record<string, { ghl_location_id?: string; ghl_social_account_id?: string; ghl_api_key?: string }> = {}
    const { data: ghlRows, error: _ghlErr } = await supabase.from('ig_accounts').select('id, ghl_location_id, ghl_social_account_id, ghl_api_key')
    if (!_ghlErr && ghlRows) {
      ghlRows.forEach((r: any) => {
        ghlByAccountId[r.id] = {
          ghl_location_id: r.ghl_location_id ?? undefined,
          ghl_social_account_id: r.ghl_social_account_id ?? undefined,
          ghl_api_key: r.ghl_api_key ?? undefined,
        }
      })
    }
    // If _ghlErr: ghl_* columns may not exist yet (Content Engine migration not run); continue without them

    const identitiesWithUsername =
      (identities || []).map((id: any) => {
        const acc = (accounts || []).find((a: any) => a.id === id.ig_account_id)
        const ghl = id.ig_account_id ? ghlByAccountId[id.ig_account_id] : null
        return {
          ...id,
          ig_username: acc?.ig_username ?? null,
          ghl_location_id: ghl?.ghl_location_id ?? null,
          ghl_social_account_id: ghl?.ghl_social_account_id ?? null,
          ghl_api_key: ghl?.ghl_api_key ?? null,
        }
      }) || []

    const usedAccountIds = new Set(
      (identities || []).map((id: any) => id.ig_account_id).filter(Boolean)
    )
    const available_accounts = (accounts || []).map((a: any) => ({
      ...a,
      ...ghlByAccountId[a.id],
    })).filter((a) => !usedAccountIds.has(a.id))

    return NextResponse.json({ identities: identitiesWithUsername, available_accounts })
  } catch (e) {
    console.error('[Admin/Identities] GET unhandled error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const {
      ig_account_id,
      display_name,
      theme_id,
      color_primary,
      color_secondary,
      color_bg,
      color_text,
      color_accent,
      font_heading,
      font_body,
      voice_prompt,
      caption_style,
      content_pillars,
      image_styles,
      image_subjects,
      posting_times,
      posting_days,
      posts_per_day,
      carousel_ratio,
      hashtag_pool,
      ghl_location_id,
      ghl_social_account_id,
      ghl_api_key,
    } = body

    if (!ig_account_id || !display_name || !theme_id) {
      return NextResponse.json(
        { error: 'Missing required fields: ig_account_id, display_name, theme_id' },
        { status: 400 }
      )
    }

    // Enforce unique theme across accounts
    const { data: existing } = await supabase
      .from('account_identities')
      .select('id, display_name')
      .eq('theme_id', theme_id)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Theme already used by ${existing[0].display_name || 'another account'}` },
        { status: 400 }
      )
    }

    const { data, error: insertError } = await supabase
      .from('account_identities')
      .insert({
        ig_account_id,
        display_name,
        theme_id,
        color_primary,
        color_secondary,
        color_bg,
        color_text,
        color_accent,
        font_heading,
        font_body,
        voice_prompt,
        caption_style,
        content_pillars,
        image_styles,
        image_subjects,
        posting_times,
        posting_days,
        posts_per_day,
        carousel_ratio,
        hashtag_pool,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Admin/Identities] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create identity' }, { status: 500 })
    }

    if (ig_account_id && (ghl_location_id !== undefined || ghl_social_account_id !== undefined || ghl_api_key !== undefined)) {
      const ghlUpdate: Record<string, string | null> = {}
      if (ghl_location_id !== undefined) ghlUpdate.ghl_location_id = ghl_location_id || null
      if (ghl_social_account_id !== undefined) ghlUpdate.ghl_social_account_id = ghl_social_account_id || null
      if (ghl_api_key !== undefined) ghlUpdate.ghl_api_key = ghl_api_key || null
      if (Object.keys(ghlUpdate).length) {
        await supabase.from('ig_accounts').update(ghlUpdate).eq('id', ig_account_id)
      }
    }

    return NextResponse.json({ id: data.id })
  } catch (e: any) {
    console.error('[Admin/Identities] POST error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const {
      id,
      ig_account_id,
      display_name,
      theme_id,
      color_primary,
      color_secondary,
      color_bg,
      color_text,
      color_accent,
      font_heading,
      font_body,
      voice_prompt,
      caption_style,
      content_pillars,
      image_styles,
      image_subjects,
      posting_times,
      posting_days,
      posts_per_day,
      carousel_ratio,
      hashtag_pool,
      ghl_location_id,
      ghl_social_account_id,
      ghl_api_key,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    // Unique theme check excluding self
    if (theme_id) {
      const { data: existing } = await supabase
        .from('account_identities')
        .select('id, display_name')
        .eq('theme_id', theme_id)
        .neq('id', id)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: `Theme already used by ${existing[0].display_name || 'another account'}` },
          { status: 400 }
        )
      }
    }

    const { error: updateError } = await supabase
      .from('account_identities')
      .update({
        ig_account_id,
        display_name,
        theme_id,
        color_primary,
        color_secondary,
        color_bg,
        color_text,
        color_accent,
        font_heading,
        font_body,
        voice_prompt,
        caption_style,
        content_pillars,
        image_styles,
        image_subjects,
        posting_times,
        posting_days,
        posts_per_day,
        carousel_ratio,
        hashtag_pool,
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Admin/Identities] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update identity' }, { status: 500 })
    }

    if (ig_account_id && (ghl_location_id !== undefined || ghl_social_account_id !== undefined || ghl_api_key !== undefined)) {
      const ghlUpdate: Record<string, string | null> = {}
      if (ghl_location_id !== undefined) ghlUpdate.ghl_location_id = ghl_location_id || null
      if (ghl_social_account_id !== undefined) ghlUpdate.ghl_social_account_id = ghl_social_account_id || null
      if (ghl_api_key !== undefined) ghlUpdate.ghl_api_key = ghl_api_key || null
      if (Object.keys(ghlUpdate).length) {
        await supabase.from('ig_accounts').update(ghlUpdate).eq('id', ig_account_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[Admin/Identities] PATCH error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

