import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichArtist } from '@/lib/enrichment/pipeline'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artistIds } = await request.json()

    if (!artistIds || !Array.isArray(artistIds) || artistIds.length === 0) {
      return NextResponse.json({ error: 'No artist IDs provided' }, { status: 400 })
    }

    // Fetch all artists
    const { data: artists, error: fetchError } = await supabase
      .from('artists')
      .select('*')
      .in('id', artistIds)

    if (fetchError || !artists) {
      return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
    }

    // API keys
    const apiKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY,
    }

    const results = []
    const errors = []

    // Process each artist with a 1 second delay to avoid rate limits
    for (let i = 0; i < artists.length; i++) {
      const artist = artists[i]

      try {
        const result = await enrichArtist(artist, apiKeys)

        // Update artist record
        const updateData: any = {
          email: result.email_found,
          email_confidence: result.email_confidence,
          email_source: result.email_source,
          all_emails_found: result.all_emails,
          is_enriched: true,
          is_contactable: result.is_contactable,
          last_enriched_at: new Date().toISOString(),
          enrichment_attempts: artist.enrichment_attempts + 1,
          updated_at: new Date().toISOString(),
        }

        await supabase
          .from('artists')
          .update(updateData)
          .eq('id', artist.id)

        results.push({
          artist_id: artist.id,
          artist_name: artist.name,
          success: result.is_contactable,
          email: result.email_found,
        })

        // Delay between requests (1 second)
        if (i < artists.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (err: any) {
        errors.push({
          artist_id: artist.id,
          artist_name: artist.name,
          error: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      total: artists.length,
      enriched: results.length,
      found_emails: results.filter(r => r.success).length,
      results,
      errors,
    })
  } catch (error: any) {
    console.error('Error bulk enriching artists:', error)
    return NextResponse.json(
      { error: error.message || 'Bulk enrichment failed' },
      { status: 500 }
    )
  }
}
