import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PUT /api/artists/[id]/qualify
 * Manual override of an artist's qualification status.
 *
 * Body: { status: 'qualified' | 'not_qualified' | 'review', reason: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status, reason } = await request.json()

    if (!['qualified', 'not_qualified', 'review'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be qualified, not_qualified, or review.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('artists')
      .update({
        qualification_status: status,
        qualification_reason: reason || `Manually set to ${status}`,
        qualification_date: new Date().toISOString(),
        qualification_manual_override: true,
      })
      .eq('id', params.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating qualification:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update qualification' },
      { status: 500 }
    )
  }
}
