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
    const detailedLogs = []

    // Process each artist with a 1 second delay to avoid rate limits
    for (let i = 0; i < artists.length; i++) {
      const artist = artists[i]

      console.log(`\n[Enrichment ${i + 1}/${artists.length}] Processing: ${artist.name}`)
      console.log('- Social links:', JSON.stringify(artist.social_links || {}))
      console.log('- Instagram:', artist.instagram_handle || 'None')
      console.log('- Website:', artist.website || 'None')
      console.log('- Biography:', artist.biography ? 'Yes' : 'No')
      console.log('- APIFY_TOKEN present:', !!process.env.APIFY_TOKEN)

      try {
        console.log('[Bulk Enrich] About to call enrichArtist...')
        const result = await enrichArtist(artist, apiKeys)
        console.log('[Bulk Enrich] enrichArtist returned')

        console.log('- Result:', {
          email_found: result.email_found || 'None',
          confidence: result.email_confidence,
          source: result.email_source || 'None',
          steps_completed: result.steps.filter(s => s.status !== 'skipped').length,
        })

        // Log each step's result
        result.steps.forEach((step, idx) => {
          if (step.status !== 'skipped') {
            console.log(`  Step ${idx + 1} (${step.label}): ${step.status} - ${step.emails_found.length} emails`)
            if (step.error) {
              console.log(`    Error: ${step.error}`)
            }
          }
        })

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

        // Store detailed log for UI display
        detailedLogs.push(result)

        // Save enrichment log to database
        const { error: logError } = await supabase
          .from('enrichment_logs')
          .insert({
            artist_id: artist.id,
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
          console.error(`[Bulk Enrich] Failed to save log for ${artist.name}:`, logError.message, logError.details, logError.hint)
        }

        // Delay between requests (1 second)
        if (i < artists.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (err: any) {
        console.error(`- Error enriching ${artist.name}:`, err.message)
        errors.push({
          artist_id: artist.id,
          artist_name: artist.name,
          error: err.message,
        })

        // Add failed log entry
        detailedLogs.push({
          artist_id: artist.id,
          artist_name: artist.name,
          email_found: null,
          email_confidence: 0,
          email_source: '',
          all_emails: [],
          steps: [],
          total_duration_ms: 0,
          is_contactable: false,
        })
      }
    }

    console.log(`\n[Enrichment Complete] Total: ${artists.length}, Found emails: ${results.filter(r => r.success).length}`)

    return NextResponse.json({
      success: true,
      total: artists.length,
      enriched: results.length,
      found_emails: results.filter(r => r.success).length,
      results,
      errors,
      detailed_logs: detailedLogs,
    })
  } catch (error: any) {
    console.error('Error bulk enriching artists:', error)
    return NextResponse.json(
      { error: error.message || 'Bulk enrichment failed' },
      { status: 500 }
    )
  }
}
