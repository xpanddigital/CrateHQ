import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { InstantlyClient, artistToInstantlyLead } from '@/lib/instantly/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId, artistIds } = await request.json()

    if (!campaignId || !artistIds || !Array.isArray(artistIds)) {
      return NextResponse.json(
        { error: 'Campaign ID and artist IDs are required' },
        { status: 400 }
      )
    }

    // Get Instantly API key
    const { data: integration } = await supabase
      .from('integrations')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('service', 'instantly')
      .single()

    if (!integration?.api_key) {
      return NextResponse.json(
        { error: 'Instantly not configured' },
        { status: 400 }
      )
    }

    // Get scout profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Fetch artists
    const { data: artists, error: artistsError } = await supabase
      .from('artists')
      .select('*')
      .in('id', artistIds)
      .eq('is_contactable', true)

    if (artistsError || !artists) {
      return NextResponse.json(
        { error: 'Failed to fetch artists' },
        { status: 500 }
      )
    }

    // Transform to Instantly leads
    const leads = artists
      .map(artist => artistToInstantlyLead(artist, profile || {}))
      .filter(Boolean) as any[]

    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads to push' },
        { status: 400 }
      )
    }

    // Push to Instantly
    const client = new InstantlyClient(integration.api_key)
    const result = await client.addLeads(campaignId, leads)

    // Create deals for each artist
    const dealsToCreate = artists.map(artist => ({
      artist_id: artist.id,
      scout_id: user.id,
      stage: 'outreach_queued' as const,
      instantly_campaign_id: campaignId,
      estimated_deal_value: artist.estimated_offer || null,
    }))

    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .insert(dealsToCreate)
      .select()

    if (dealsError) {
      console.error('Error creating deals:', dealsError)
      // Don't fail the request, leads were still pushed
    }

    return NextResponse.json({
      success: true,
      added: result.added,
      skipped: result.skipped,
      deals_created: deals?.length || 0,
    })
  } catch (error: any) {
    console.error('Error pushing leads:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to push leads' },
      { status: 500 }
    )
  }
}
