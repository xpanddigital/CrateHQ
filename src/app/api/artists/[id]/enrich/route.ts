import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichArtist } from '@/lib/enrichment/pipeline'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the artist
    const { data: artist, error: fetchError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    // Run enrichment pipeline
    console.log(`[Single Enrich] Starting for: ${artist.name} (${artist.id})`)
    console.log(`[Single Enrich] Social links:`, JSON.stringify(artist.social_links || {}))
    console.log(`[Single Enrich] APIFY_TOKEN present:`, !!process.env.APIFY_TOKEN)
    console.log(`[Single Enrich] ANTHROPIC_API_KEY present:`, !!process.env.ANTHROPIC_API_KEY)
    
    const apiKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY,
    }

    console.log(`[Single Enrich] Calling enrichArtist...`)
    const result = await enrichArtist(artist, apiKeys)
    console.log(`[Single Enrich] Enrichment complete. Email found:`, result.email_found || 'None')

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

    // Save discovered YouTube URL to social_links if it's new
    if (result.discovered_youtube_url) {
      const currentLinks = artist.social_links || {}
      const existingYt = currentLinks.youtube || currentLinks.youtube_url || ''
      if (!existingYt) {
        updateData.social_links = {
          ...currentLinks,
          youtube: result.discovered_youtube_url,
        }
        console.log(`[Single Enrich] Saving discovered YouTube URL to profile: ${result.discovered_youtube_url}`)
      }
    }

    const { error: updateError } = await supabase
      .from('artists')
      .update(updateData)
      .eq('id', params.id)

    if (updateError) throw updateError

    // Save enrichment log to database
    const { error: logError } = await supabase
      .from('enrichment_logs')
      .insert({
        artist_id: params.id,
        artist_name: artist.name,
        email_found: result.email_found,
        email_confidence: result.email_confidence,
        email_source: result.email_source || '',
        all_emails: result.all_emails || [],
        steps: result.steps || [],
        total_duration_ms: result.total_duration_ms,
        is_contactable: result.is_contactable,
        run_by: user.id,
        error_details: result.error_details || null,
      })

    if (logError) {
      console.error('[Single Enrich] Failed to save enrichment log:', logError.message, logError.details, logError.hint)
    } else {
      console.log('[Single Enrich] Enrichment log saved successfully')
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error enriching artist:', error)
    return NextResponse.json(
      { error: error.message || 'Enrichment failed' },
      { status: 500 }
    )
  }
}
