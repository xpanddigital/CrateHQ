import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { valuateAndQualify } from '@/lib/qualification/qualifier'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { artists, format = 'cratehq' } = body

    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return NextResponse.json({ error: 'No artists provided' }, { status: 400 })
    }

    // ── Deduplication ────────────────────────────────────────────
    // Collect spotify_ids and names for batch lookup
    const spotifyIds = artists
      .map((a: any) => a.spotify_id)
      .filter(Boolean) as string[]

    const artistNames = artists
      .map((a: any) => (a.name || '').trim().toLowerCase())
      .filter(Boolean)

    // Fetch existing artists by spotify_id
    let existingBySpotifyId: Record<string, any> = {}
    if (spotifyIds.length > 0) {
      const { data: existing } = await supabase
        .from('artists')
        .select('id, spotify_id, name')
        .in('spotify_id', spotifyIds)

      if (existing) {
        for (const e of existing) {
          if (e.spotify_id) existingBySpotifyId[e.spotify_id] = e
        }
      }
    }

    // Fetch existing artists by name (case-insensitive)
    let existingByName: Record<string, any> = {}
    if (artistNames.length > 0) {
      // Batch in chunks of 200 to avoid query limits
      for (let i = 0; i < artistNames.length; i += 200) {
        const chunk = artists.slice(i, i + 200).map((a: any) => (a.name || '').trim())
        const { data: existing } = await supabase
          .from('artists')
          .select('id, spotify_id, name')
          .in('name', chunk)

        if (existing) {
          for (const e of existing) {
            existingByName[e.name.toLowerCase()] = e
          }
        }
      }
    }

    // ── Transform & Split into inserts vs updates ────────────────
    const toInsert: any[] = []
    const toUpdate: Array<{ id: string; data: any }> = []
    let duplicateCount = 0

    const sourceBatch = new Date().toISOString()

    for (const artist of artists) {
      // Build the record
      let instagramHandle = artist.instagram_handle
      if (artist.instagram_url) {
        const match = artist.instagram_url.match(/instagram\.com\/([^/?]+)/)
        if (match) instagramHandle = match[1]
      }

      const socialLinks: Record<string, string> = {}
      if (artist.instagram_url) socialLinks.instagram = artist.instagram_url
      if (artist.facebook_url) socialLinks.facebook = artist.facebook_url
      if (artist.twitter_url) socialLinks.twitter = artist.twitter_url
      if (artist.tiktok_url) socialLinks.tiktok = artist.tiktok_url
      if (artist.youtube_url) socialLinks.youtube = artist.youtube_url
      if (artist.spotify_url) socialLinks.spotify = artist.spotify_url
      if (artist.website) socialLinks.website = artist.website

      const record: any = {
        name: artist.name,
        email: artist.email || null,
        email_source: artist.email_source || null,
        email_confidence: artist.email_confidence || 0,
        instagram_handle: instagramHandle || null,
        instagram_followers: artist.instagram_followers || 0,
        website: artist.website || null,
        spotify_url: artist.spotify_url || null,
        spotify_id: artist.spotify_id || null,
        spotify_monthly_listeners: artist.spotify_monthly_listeners || 0,
        spotify_followers: artist.spotify_followers || 0,
        spotify_verified: artist.spotify_verified || false,
        streams_last_month: artist.streams_last_month || 0,
        streams_estimated: artist.streams_estimated || false,
        total_top_track_streams: artist.total_top_track_streams || 0,
        track_count: artist.track_count || 0,
        genres: artist.genres || [],
        country: artist.country || null,
        biography: artist.biography || null,
        bio_emails: artist.bio_emails || null,
        management_company: artist.management_company || null,
        booking_agency: artist.booking_agency || null,
        social_links: socialLinks,
        world_rank: artist.world_rank || 0,
        cover_art_url: artist.cover_art_url || null,
        latest_release_date: artist.latest_release_date || null,
        latest_release_name: artist.latest_release_name || null,
        top_cities: artist.top_cities || null,
        growth_yoy: artist.growth_yoy || 0,
        estimated_offer: artist.estimated_offer || null,
        estimated_offer_low: artist.estimated_offer_low || null,
        estimated_offer_high: artist.estimated_offer_high || null,
        import_format: format,
        source: 'csv_import',
        source_batch: sourceBatch,
        is_contactable: !!artist.email,
      }

      // Check for duplicate
      const existingById = artist.spotify_id ? existingBySpotifyId[artist.spotify_id] : null
      const existingByN = existingByName[(artist.name || '').trim().toLowerCase()]
      const existing = existingById || existingByN

      if (existing) {
        duplicateCount++
        // Merge: only update fields that are non-null in the new data
        const updateData: any = {}
        for (const [key, value] of Object.entries(record)) {
          if (value !== null && value !== undefined && value !== 0 && value !== '' && key !== 'source' && key !== 'source_batch') {
            // Don't overwrite existing email with null
            if (key === 'email' && !value) continue
            updateData[key] = value
          }
        }
        updateData.updated_at = new Date().toISOString()
        toUpdate.push({ id: existing.id, data: updateData })
      } else {
        toInsert.push(record)
      }
    }

    // ── Insert new artists ───────────────────────────────────────
    let insertedData: any[] = []
    if (toInsert.length > 0) {
      // Insert in chunks of 500
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500)
        const { data, error } = await supabase
          .from('artists')
          .insert(chunk)
          .select()

        if (error) {
          console.error(`[Import] Insert chunk ${i} failed:`, error.message)
          throw error
        }
        if (data) insertedData.push(...data)
      }
    }

    // ── Update existing artists ──────────────────────────────────
    let updatedCount = 0
    for (const { id, data } of toUpdate) {
      const { error } = await supabase
        .from('artists')
        .update(data)
        .eq('id', id)

      if (!error) updatedCount++
    }

    // ── Run valuation + qualification ────────────────────────────
    const qualificationSummary = { qualified: 0, not_qualified: 0, review: 0, pending: 0 }
    const allArtists = [...insertedData, ...toUpdate.map(u => ({ id: u.id, ...u.data }))]

    for (const artist of allArtists) {
      try {
        const result = valuateAndQualify({
          id: artist.id,
          name: artist.name,
          estimated_offer: artist.estimated_offer,
          estimated_offer_low: artist.estimated_offer_low,
          estimated_offer_high: artist.estimated_offer_high,
          spotify_monthly_listeners: artist.spotify_monthly_listeners || 0,
          streams_last_month: artist.streams_last_month || artist.total_top_track_streams || 0,
          track_count: artist.track_count || 0,
        })

        await supabase.from('artists').update(result).eq('id', artist.id)
        qualificationSummary[result.qualification_status]++
      } catch (err) {
        console.error(`[Import] Qualification failed for ${artist.name}:`, err)
        qualificationSummary.pending++
      }
    }

    // Count bio emails found
    const bioEmailsFound = artists.filter((a: any) => a.bio_emails && a.bio_emails.length > 0).length

    return NextResponse.json({
      success: true,
      count: insertedData.length,
      updated: updatedCount,
      duplicates: duplicateCount,
      bioEmailsFound,
      format,
      qualification: qualificationSummary,
    })
  } catch (error: any) {
    console.error('Error importing artists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import artists' },
      { status: 500 }
    )
  }
}
