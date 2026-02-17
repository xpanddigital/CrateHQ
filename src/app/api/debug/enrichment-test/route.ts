import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findYouTubeUrl, findInstagramHandle, findWebsiteUrl } from '@/lib/enrichment/apify-fetch'

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

    const youtubeUrl = findYouTubeUrl(artist)
    const instagramHandle = findInstagramHandle(artist)
    const websiteUrl = findWebsiteUrl(artist)

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
      pipeline_inputs: {
        step1_youtube: youtubeUrl || 'NONE — will skip Step 1',
        step2_instagram: instagramHandle ? `@${instagramHandle}` : 'NONE — will skip Step 2',
        step3_linktree: 'Determined after Step 2 (externalUrl from Instagram)',
        step4_website: websiteUrl || 'NONE — will skip Step 4',
        step5_facebook: 'SKIPPED (requires login)',
        step6_remaining: 'SKIPPED (platforms block scraping)',
      },
      actors: {
        step1: 'streamers~youtube-scraper',
        step2: 'apify~instagram-profile-scraper',
        step3: 'apify~website-content-crawler (fallback only)',
        step4: 'apify~website-content-crawler (fallback only)',
      },
      diagnosis: (!youtubeUrl && !instagramHandle && !websiteUrl)
        ? 'No social URLs found. Check social_links JSONB structure.'
        : `Found: ${[youtubeUrl && 'YouTube', instagramHandle && 'Instagram', websiteUrl && 'Website'].filter(Boolean).join(', ')}`,
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
