import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
    const isContactable = searchParams.get('is_contactable')
    const isEnriched = searchParams.get('is_enriched')
    const qualificationStatus = searchParams.get('qualification_status')

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('artists')
      .select(`
        *,
        tags:artist_tags(tag:tags(*))
      `, { count: 'exact' })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (isContactable === 'true') {
      query = query.eq('is_contactable', true)
    }

    if (isEnriched === 'true') {
      query = query.eq('is_enriched', true)
    }

    if (qualificationStatus && qualificationStatus !== 'all') {
      query = query.eq('qualification_status', qualificationStatus)
    }

    query = query.order('created_at', { ascending: false })
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    // Transform tags structure
    const artists = data?.map(artist => ({
      ...artist,
      tags: artist.tags?.map((t: any) => t.tag).filter(Boolean) || []
    }))

    return NextResponse.json({
      artists,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error: any) {
    console.error('Error fetching artists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch artists' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      email,
      instagram_handle,
      website,
      spotify_monthly_listeners,
      genres,
      ...rest
    } = body

    const { data: artist, error } = await supabase
      .from('artists')
      .insert({
        name,
        email,
        instagram_handle,
        website,
        spotify_monthly_listeners: spotify_monthly_listeners || 0,
        genres: genres || [],
        source: 'manual',
        ...rest
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ artist }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating artist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create artist' },
      { status: 500 }
    )
  }
}
