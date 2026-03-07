import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/server'

export async function POST() {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const { error: updateError } = await supabase
      .from('ig_accounts')
      .update({ is_active: false })
      .neq('id', 'dummy_condition') // Force update all rows (Supabase sometimes requires a filter to update multiple rows safely)

    // Alternative if the above doesn't work:
    // .neq('is_active', false) to only update the ones that are true

    // Actually, .neq('id', 'invalid_id_format_to_match_nothing') is better written as:
    const { error: finalUpdateError } = await supabase
      .from('ig_accounts')
      .update({ is_active: false })
      .neq('is_active', false) // Only update ones that are true/null to be safe and satisfy PostgREST requirements

    if (finalUpdateError) {
      console.error('[Global Panic] Update error:', finalUpdateError)
      return NextResponse.json({ error: finalUpdateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'All accounts paused' })
  } catch (error: any) {
    console.error('[Global Panic] Unhandled error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
