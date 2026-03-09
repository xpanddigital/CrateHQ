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
 * POST /api/sequences/enrollments/bulk-action
 * Body: { enrollment_ids: string[], action: 'pause' | 'resume' | 'cancel' }
 */
export async function POST(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { enrollment_ids, action } = body

    if (!Array.isArray(enrollment_ids) || enrollment_ids.length === 0) {
      return NextResponse.json({ error: 'enrollment_ids must be a non-empty array' }, { status: 400 })
    }

    const allowedActions = ['pause', 'resume', 'cancel']
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${allowedActions.join(', ')}` },
        { status: 400 }
      )
    }

    let newStatus: string
    let filterStatuses: string[]

    switch (action) {
      case 'pause':
        newStatus = 'paused'
        filterStatuses = ['active']
        break
      case 'resume':
        newStatus = 'active'
        filterStatuses = ['paused']
        break
      case 'cancel':
        newStatus = 'cancelled'
        filterStatuses = ['active', 'paused']
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('sequence_enrollments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in('id', enrollment_ids)
      .in('status', filterStatuses)
      .select('id')

    if (updateError) {
      logger.error('[Sequences/BulkAction] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update enrollments' }, { status: 500 })
    }

    return NextResponse.json({
      action,
      updated: updated?.length || 0,
      requested: enrollment_ids.length,
    })
  } catch (err) {
    logger.error('[Sequences/BulkAction] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
