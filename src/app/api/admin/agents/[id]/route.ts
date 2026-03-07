import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const id = params.id
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
      console.error('[Admin Agents PATCH] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ account: data })
  } catch (error: any) {
    console.error('[Admin Agents PATCH] Unhandled error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
