import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { postId, scheduled_date, scheduled_time } = body || {}
    if (!postId || !scheduled_date || !scheduled_time) {
      return NextResponse.json(
        { error: 'Missing postId, scheduled_date, or scheduled_time' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('content_posts')
      .update({
        scheduled_date,
        scheduled_time,
        status: 'scheduled',
      })
      .eq('id', postId)

    if (error) {
      logger.error('[Admin/CalendarSchedule] Update error:', error)
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    logger.error('[Admin/CalendarSchedule] Error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

