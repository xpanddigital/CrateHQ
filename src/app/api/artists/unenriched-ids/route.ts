import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get all artist IDs without emails that are qualified for enrichment.
 * Only returns artists where qualification_status = 'qualified' (or 'pending' for backwards compat).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeUnqualified = request.nextUrl.searchParams.get('all') === 'true'

    let query = supabase
      .from('artists')
      .select('id, qualification_status')
      .or('email.is.null,email.eq.')

    if (!includeUnqualified) {
      // Only return qualified or pending (not yet evaluated) artists
      query = query.in('qualification_status', ['qualified', 'pending'])
    }

    const { data: artists, error } = await query

    if (error) throw error

    const ids = artists?.map(a => a.id) || []
    const qualifiedCount = artists?.filter(a => a.qualification_status === 'qualified').length || 0
    const pendingCount = artists?.filter(a => a.qualification_status === 'pending').length || 0

    return NextResponse.json({ 
      ids,
      count: ids.length,
      qualified_count: qualifiedCount,
      pending_count: pendingCount,
    })
  } catch (error: any) {
    console.error('Error fetching unenriched IDs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch IDs' },
      { status: 500 }
    )
  }
}
