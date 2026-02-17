import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      checks: [],
    }

    // Check 1: Anthropic API Key
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    diagnostics.checks.push({
      name: 'Anthropic API Key',
      status: anthropicKey ? 'configured' : 'missing',
      details: anthropicKey ? `Key present (${anthropicKey.slice(0, 15)}...)` : 'Not found in environment',
    })

    // Check 2: Test Anthropic API
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey })
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: 'Reply with just "OK"'
          }]
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        diagnostics.checks.push({
          name: 'Anthropic API Test',
          status: 'success',
          details: `API working, response: "${text}"`,
        })
      } catch (error: any) {
        diagnostics.checks.push({
          name: 'Anthropic API Test',
          status: 'error',
          details: error.message,
        })
      }
    }

    // Check 3: Sample Artists Data
    const { data: sampleArtists } = await supabase
      .from('artists')
      .select('id, name, social_links, instagram_handle, website, biography')
      .limit(5)

    const artistDataQuality = sampleArtists?.map(artist => ({
      name: artist.name,
      has_social_links: Object.keys(artist.social_links || {}).length > 0,
      social_link_count: Object.keys(artist.social_links || {}).length,
      has_instagram: !!artist.instagram_handle,
      has_website: !!artist.website,
      has_biography: !!artist.biography,
      enrichment_score: [
        Object.keys(artist.social_links || {}).length > 0,
        !!artist.instagram_handle,
        !!artist.website,
        !!artist.biography,
      ].filter(Boolean).length,
    }))

    diagnostics.checks.push({
      name: 'Artist Data Quality',
      status: artistDataQuality && artistDataQuality.some(a => a.enrichment_score > 0) ? 'good' : 'poor',
      details: `Checked ${artistDataQuality?.length || 0} sample artists`,
      sample_artists: artistDataQuality,
    })

    // Check 4: Total Artists Count
    const { count: totalArtists } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true })

    const { count: artistsWithSocialData } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true })
      .not('social_links', 'eq', '{}')

    diagnostics.checks.push({
      name: 'Database Stats',
      status: 'info',
      details: {
        total_artists: totalArtists || 0,
        artists_with_social_data: artistsWithSocialData || 0,
        percentage: totalArtists ? ((artistsWithSocialData || 0) / totalArtists * 100).toFixed(1) + '%' : '0%',
      },
    })

    // Summary
    const hasApiKey = !!anthropicKey
    const apiWorks = diagnostics.checks.find((c: any) => c.name === 'Anthropic API Test')?.status === 'success'
    const hasData = artistDataQuality && artistDataQuality.some((a: any) => a.enrichment_score > 0)

    diagnostics.summary = {
      ready_for_enrichment: hasApiKey && apiWorks && hasData,
      issues: [
        !hasApiKey && 'Missing Anthropic API key',
        hasApiKey && !apiWorks && 'Anthropic API not working',
        !hasData && 'Artists missing social data (need to scrape first)',
      ].filter(Boolean),
    }

    return NextResponse.json(diagnostics)
  } catch (error: any) {
    console.error('Error running diagnostics:', error)
    return NextResponse.json(
      { error: error.message || 'Diagnostics failed' },
      { status: 500 }
    )
  }
}
