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
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
    const isContactable = searchParams.get('is_contactable')
    const isEnriched = searchParams.get('is_enriched')
    const exportType = searchParams.get('type') || 'full'

    let query = supabase.from('artists').select('*')

    // Apply filters
    if (isContactable === 'true') {
      query = query.eq('is_contactable', true)
    }
    if (isEnriched === 'true') {
      query = query.eq('is_enriched', true)
    }
    // Note: Tag filtering would require a join, skipping for now

    const { data: artists, error } = await query

    if (error) throw error

    let csv = ''

    if (exportType === 'valuation') {
      // Valuation tuning export
      csv = 'name,spotify_monthly_listeners,streams_last_month,track_count,instagram_followers,growth_yoy,estimated_offer_low,estimated_offer,estimated_offer_high\n'
      
      artists?.forEach(artist => {
        const row = [
          `"${artist.name}"`,
          artist.spotify_monthly_listeners || 0,
          artist.streams_last_month || 0,
          artist.track_count || 0,
          artist.instagram_followers || 0,
          artist.growth_yoy || 0,
          artist.estimated_offer_low || '',
          artist.estimated_offer || '',
          artist.estimated_offer_high || '',
        ]
        csv += row.join(',') + '\n'
      })
    } else {
      // Full export
      csv = 'name,spotify_url,spotify_monthly_listeners,streams_last_month,track_count,genres,country,email,email_secondary,email_management,instagram_handle,instagram_url,website,youtube_url,estimated_offer_low,estimated_offer,estimated_offer_high,qualification_status,qualification_reason,is_enriched,is_contactable,source,created_at\n'
      
      artists?.forEach(artist => {
        const igUrl = artist.instagram_handle
          ? `https://instagram.com/${artist.instagram_handle}`
          : ''
        const row = [
          `"${(artist.name || '').replace(/"/g, '""')}"`,
          artist.spotify_url || '',
          artist.spotify_monthly_listeners || 0,
          artist.streams_last_month || 0,
          artist.track_count || 0,
          `"${Array.isArray(artist.genres) ? artist.genres.join(';') : ''}"`,
          artist.country || '',
          artist.email || '',
          artist.email_secondary || '',
          artist.email_management || '',
          artist.instagram_handle || '',
          igUrl,
          artist.website || '',
          artist.youtube_url || '',
          artist.estimated_offer_low || '',
          artist.estimated_offer || '',
          artist.estimated_offer_high || '',
          artist.qualification_status || '',
          `"${(artist.qualification_reason || '').replace(/"/g, '""')}"`,
          artist.is_enriched,
          artist.is_contactable,
          artist.source || '',
          artist.created_at,
        ]
        csv += row.join(',') + '\n'
      })
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="artists-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting artists:', error)
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}
