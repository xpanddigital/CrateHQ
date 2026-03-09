import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase: null as any, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { supabase: null as any, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { supabase, error: null }
}

/**
 * GET /api/sequences/enrollments/[id] — Get single enrollment with details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const { data: enrollment, error: fetchError } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        artist:artists(id, name, instagram_handle, image_url),
        template:sequence_templates(id, name, steps)
      `)
      .eq('id', id)
      .single()

    if (fetchError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    // Fetch step logs for this enrollment
    const { data: stepLogs } = await supabase
      .from('sequence_step_log')
      .select('*')
      .eq('enrollment_id', id)
      .order('step_number', { ascending: true })

    return NextResponse.json({ enrollment, step_logs: stepLogs || [] })
  } catch (err) {
    logger.error('[Sequences/Enrollments] GET [id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/sequences/enrollments/[id] — Update enrollment
 * Body: { status?: 'paused' | 'cancelled', dm_message_text?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { status, dm_message_text } = body

    const updateData: any = { updated_at: new Date().toISOString() }

    if (status !== undefined) {
      const allowedStatuses = ['paused', 'cancelled']
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `status must be one of: ${allowedStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = status
    }

    if (dm_message_text !== undefined) {
      updateData.dm_message_text = dm_message_text
    }

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: enrollment, error: updateError } = await supabase
      .from('sequence_enrollments')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      logger.error('[Sequences/Enrollments] PATCH error:', updateError)
      return NextResponse.json({ error: 'Failed to update enrollment' }, { status: 500 })
    }

    return NextResponse.json({ enrollment })
  } catch (err) {
    logger.error('[Sequences/Enrollments] PATCH unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
