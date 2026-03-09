import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }

  return { supabase, user }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { assigned_scout_id, daily_cold_dm_limit, is_active } = body

    const updateData: any = {}
    if (assigned_scout_id !== undefined) {
      updateData.assigned_scout_id = assigned_scout_id === '' ? null : assigned_scout_id
    }
    if (daily_cold_dm_limit !== undefined) {
      updateData.daily_cold_dm_limit = daily_cold_dm_limit
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error: updateError } = await supabase
      .from('ig_accounts')
      .update(updateData)
      .eq('id', id)
      .select('id, ig_username, assigned_scout_id, daily_cold_dm_limit, is_active')
      .single()

    if (updateError) {
      logger.error('[Admin Agents PATCH] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ account: data })
  } catch (error: any) {
    logger.error('[Admin Agents PATCH] Unhandled error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
