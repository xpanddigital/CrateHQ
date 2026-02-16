import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDatasetItems } from '@/lib/apify/client'

export async function GET(request: NextRequest) {
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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const datasetId = searchParams.get('datasetId')

    if (!datasetId) {
      return NextResponse.json({ error: 'Dataset ID required' }, { status: 400 })
    }

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) {
      return NextResponse.json({ error: 'Apify not configured' }, { status: 500 })
    }

    const items = await getDatasetItems(apifyToken, datasetId)

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Results fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch results' },
      { status: 500 }
    )
  }
}
