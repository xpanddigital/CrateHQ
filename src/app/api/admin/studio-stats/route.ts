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

    const identityId = request.nextUrl.searchParams.get('identity_id')
    if (!identityId) {
      return NextResponse.json({ error: 'Missing identity_id' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('content_posts')
      .select('post_type', { count: 'exact', head: false })
      .eq('identity_id', identityId)

    if (error) {
      logger.error('[Admin/StudioStats] Query error:', error)
      return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
    }

    let carousels = 0
    let singles = 0
    for (const row of data || []) {
      if (row.post_type === 'carousel') carousels++
      if (row.post_type === 'single') singles++
    }

    return NextResponse.json({ carousels, singles })
  } catch (e: any) {
    logger.error('[Admin/StudioStats] Error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

