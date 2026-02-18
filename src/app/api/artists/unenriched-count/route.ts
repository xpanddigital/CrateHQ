import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get count of artists without emails (unenriched)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count qualified artists where email is null or empty
    const { count, error } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true })
      .or('email.is.null,email.eq.')
      .in('qualification_status', ['qualified', 'pending'])

    if (error) throw error

    return NextResponse.json({ count: count || 0 })
  } catch (error: any) {
    console.error('Error fetching unenriched count:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch count' },
      { status: 500 }
    )
  }
}
