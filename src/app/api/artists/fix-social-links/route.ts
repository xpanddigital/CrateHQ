import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * One-time migration to populate social_links from individual URL columns
 * This fixes artists imported from CSV that have instagram_url, facebook_url, etc.
 * but don't have the social_links JSON field populated
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all artists
    const { data: artists, error: fetchError } = await supabase
      .from('artists')
      .select('*')

    if (fetchError || !artists) {
      return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
    }

    console.log(`[Fix Social Links] Processing ${artists.length} artists...`)

    let updated = 0
    let skipped = 0
    const errors = []

    for (const artist of artists) {
      try {
        // Check if social_links is empty or missing
        const hasSocialLinks = artist.social_links && Object.keys(artist.social_links).length > 0

        // Build social_links from available data
        const social_links: Record<string, string> = artist.social_links || {}
        
        // Add Instagram if we have the handle
        if (artist.instagram_handle && !social_links.instagram) {
          social_links.instagram = `https://instagram.com/${artist.instagram_handle}`
        }

        // Add Spotify if we have the URL
        if (artist.spotify_url && !social_links.spotify) {
          social_links.spotify = artist.spotify_url
        }

        // Add Website if we have it
        if (artist.website && !social_links.website) {
          social_links.website = artist.website
        }

        // Only update if we added new links
        const newLinksCount = Object.keys(social_links).length
        const oldLinksCount = hasSocialLinks ? Object.keys(artist.social_links).length : 0

        if (newLinksCount > oldLinksCount) {
          const { error: updateError } = await supabase
            .from('artists')
            .update({ social_links })
            .eq('id', artist.id)

          if (updateError) {
            console.error(`Error updating ${artist.name}:`, updateError)
            errors.push({ artist_id: artist.id, artist_name: artist.name, error: updateError.message })
          } else {
            console.log(`✅ Updated ${artist.name}: ${oldLinksCount} → ${newLinksCount} links`)
            updated++
          }
        } else {
          skipped++
        }
      } catch (err: any) {
        console.error(`Error processing ${artist.name}:`, err)
        errors.push({ artist_id: artist.id, artist_name: artist.name, error: err.message })
      }
    }

    console.log(`[Fix Social Links] Complete: ${updated} updated, ${skipped} skipped, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      total: artists.length,
      updated,
      skipped,
      errors,
    })
  } catch (error: any) {
    console.error('Error fixing social links:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fix social links' },
      { status: 500 }
    )
  }
}
