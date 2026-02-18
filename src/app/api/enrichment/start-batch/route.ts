import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, limit, filter = 'qualified' } = body

    // Query artists that need enrichment
    let query = supabase
      .from('artists')
      .select('id, name')
      .is('email', null)
      .order('created_at', { ascending: true })

    if (filter === 'qualified') {
      query = query.in('qualification_status', ['qualified', 'pending'])
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data: artists, error: queryError } = await query

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    if (!artists || artists.length === 0) {
      return NextResponse.json({ error: 'No artists found matching criteria' }, { status: 404 })
    }

    // Create batch record
    const batchName = name || `Batch ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`

    const { data: batch, error: batchError } = await supabase
      .from('enrichment_batches')
      .insert({
        name: batchName,
        total_artists: artists.length,
        status: 'queued',
        created_by: user.id,
      })
      .select()
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: batchError?.message || 'Failed to create batch' }, { status: 500 })
    }

    // Insert queue jobs in chunks of 500
    const CHUNK_SIZE = 500
    for (let i = 0; i < artists.length; i += CHUNK_SIZE) {
      const chunk = artists.slice(i, i + CHUNK_SIZE)
      const rows = chunk.map((a: any) => ({
        artist_id: a.id,
        batch_id: batch.id,
        status: 'pending',
        priority: 0,
      }))

      const { error: insertError } = await supabase
        .from('enrichment_queue')
        .insert(rows)

      if (insertError) {
        console.error(`[Start Batch] Failed to insert queue chunk ${i}:`, insertError.message)
      }
    }

    const estimatedMinutes = Math.ceil(artists.length / 3)

    return NextResponse.json({
      batchId: batch.id,
      batchName,
      totalQueued: artists.length,
      estimatedMinutes,
      estimatedHours: (estimatedMinutes / 60).toFixed(1),
    })
  } catch (error: any) {
    console.error('[Start Batch] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
