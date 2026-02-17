import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get all artist IDs without emails (unenriched)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all artists where email is null or empty, only return IDs
    const { data: artists, error } = await supabase
      .from('artists')
      .select('id')
      .or('email.is.null,email.eq.')

    if (error) throw error

    const ids = artists?.map(a => a.id) || []

    return NextResponse.json({ 
      ids,
      count: ids.length 
    })
  } catch (error: any) {
    console.error('Error fetching unenriched IDs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch IDs' },
      { status: 500 }
    )
  }
}
