import { createClient } from '@/lib/supabase/server'

export async function createSnapshot(artistId: string, data: {
  spotify_monthly_listeners?: number
  streams_last_month?: number
  track_count?: number
  instagram_followers?: number
}) {
  try {
    const supabase = await createClient()
    
    // Upsert snapshot (one per artist per day)
    const { error } = await supabase
      .from('artist_snapshots')
      .upsert({
        artist_id: artistId,
        spotify_monthly_listeners: data.spotify_monthly_listeners || 0,
        streams_last_month: data.streams_last_month || 0,
        track_count: data.track_count || 0,
        instagram_followers: data.instagram_followers || 0,
        snapshot_date: new Date().toISOString().split('T')[0],
      }, {
        onConflict: 'artist_id,snapshot_date'
      })

    if (error) {
      console.error('Error creating snapshot:', error)
    }
  } catch (error) {
    console.error('Error creating snapshot:', error)
  }
}
