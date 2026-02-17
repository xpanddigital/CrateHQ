import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { collectArtistUrls } from '@/lib/enrichment/apify-fetch'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get one unenriched artist
    const { data: artist } = await supabase
      .from('artists')
      .select('*')
      .eq('is_enriched', false)
      .limit(1)
      .single()

    if (!artist) {
      return NextResponse.json({ 
        error: 'No unenriched artists found',
        note: 'Try with any artist by removing the is_enriched filter'
      })
    }

    // Test URL collection
    const urls = collectArtistUrls(artist)

    return NextResponse.json({
      status: 'debug_info',
      environment: {
        has_apify_token: !!process.env.APIFY_TOKEN,
        apify_token_length: process.env.APIFY_TOKEN?.length || 0,
        has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
        node_env: process.env.NODE_ENV,
      },
      artist: {
        id: artist.id,
        name: artist.name,
        instagram_handle: artist.instagram_handle,
        website: artist.website,
        social_links: artist.social_links,
        social_links_keys: Object.keys(artist.social_links || {}),
      },
      url_collection: {
        collected_urls: urls,
        url_count: urls.length,
        expected_minimum: 1,
        status: urls.length > 0 ? '✅ URLs found' : '❌ No URLs collected',
      },
      diagnosis: urls.length === 0 
        ? '❌ Problem: collectArtistUrls() returned empty array. Check social_links JSONB structure.'
        : '✅ URL collection working. If Apify still not running, check Apify API or credits.',
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
