import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const start = params.get('start')
    const weeksParam = params.get('weeks') || '2'
    const accountId = params.get('account_id') || null

    if (!start) {
      return NextResponse.json({ error: 'Missing start date' }, { status: 400 })
    }

    const weeks = Math.max(1, Math.min(4, Number(weeksParam) || 2))
    const startDate = new Date(start)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + weeks * 7 - 1)

    const startIso = startDate.toISOString().slice(0, 10)
    const endIso = endDate.toISOString().slice(0, 10)

    let postsQuery = supabase
      .from('content_posts')
      .select(
        'id, ig_account_id, identity_id, post_type, status, title, category, caption, nano_prompt, slides, scheduled_date, scheduled_time'
      )
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', startIso)
      .lte('scheduled_date', endIso)

    if (accountId && accountId !== 'all') {
      postsQuery = postsQuery.eq('ig_account_id', accountId)
    }

    const { data: posts, error: postsError } = await postsQuery

    if (postsError) {
      logger.error('[Admin/CalendarData] Posts error:', postsError)
      return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 })
    }

    const identityIds = Array.from(
      new Set((posts || []).map((p: any) => p.identity_id).filter(Boolean))
    )

    let identitiesMap: Record<
      string,
      { display_name: string; color_accent: string; ig_account_id: string }
    > = {}

    if (identityIds.length > 0) {
      const { data: identities, error: idError } = await supabase
        .from('account_identities')
        .select('id, display_name, color_accent, ig_account_id')
        .in('id', identityIds)

      if (idError) {
        logger.error('[Admin/CalendarData] Identities error:', idError)
      } else {
        for (const row of identities || []) {
          identitiesMap[row.id] = {
            display_name: row.display_name,
            color_accent: row.color_accent,
            ig_account_id: row.ig_account_id,
          }
        }
      }
    }

    return NextResponse.json({
      posts: posts || [],
      identities: identitiesMap,
      start: startIso,
      end: endIso,
    })
  } catch (e: any) {
    logger.error('[Admin/CalendarData] Error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

