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
    const apiKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY,
    }

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

    const { error: updateError } = await supabase
      .from('artists')
      .update(updateData)
      .eq('id', params.id)

    if (updateError) throw updateError

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error enriching artist:', error)
    return NextResponse.json(
      { error: error.message || 'Enrichment failed' },
      { status: 500 }
    )
  }
}
