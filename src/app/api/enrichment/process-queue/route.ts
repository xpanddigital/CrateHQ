import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enrichAndSave } from '@/lib/enrichment/enrich-and-save'

const BATCH_SIZE = 3
const DELAY_BETWEEN_ARTISTS_MS = 3000

export const maxDuration = 300 // Vercel Pro plan: 300s max

export async function GET(request: NextRequest) {
  // Authenticate cron invocation
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startTime = Date.now()

  try {
    // 1. Find or start an active batch
    let { data: activeBatch } = await supabase
      .from('enrichment_batches')
      .select('*')
      .eq('status', 'processing')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!activeBatch) {
      // Look for a queued batch to start
      const { data: nextBatch } = await supabase
        .from('enrichment_batches')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!nextBatch) {
        return NextResponse.json({ status: 'idle', message: 'No batches to process' })
      }

      await supabase
        .from('enrichment_batches')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', nextBatch.id)

      activeBatch = { ...nextBatch, status: 'processing' }
    }

    // 2. Claim pending jobs (atomic: update status to 'processing')
    const { data: pendingJobs } = await supabase
      .from('enrichment_queue')
      .select('id')
      .eq('batch_id', activeBatch.id)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (!pendingJobs || pendingJobs.length === 0) {
      // No more pending jobs — check if batch is done
      const { count: remaining } = await supabase
        .from('enrichment_queue')
        .select('id', { count: 'exact', head: true })
        .eq('batch_id', activeBatch.id)
        .in('status', ['pending', 'processing'])

      if (remaining === 0) {
        await supabase
          .from('enrichment_batches')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', activeBatch.id)

        return NextResponse.json({
          status: 'batch_completed',
          batchId: activeBatch.id,
          batchName: activeBatch.name,
        })
      }

      return NextResponse.json({ status: 'waiting', message: 'Jobs in progress from another invocation' })
    }

    const jobIds = pendingJobs.map((j: any) => j.id)

    // Mark jobs as processing
    await supabase
      .from('enrichment_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .in('id', jobIds)

    // 3. Fetch full job + artist data
    const { data: jobs } = await supabase
      .from('enrichment_queue')
      .select('*, artists(*)')
      .in('id', jobIds)

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ status: 'error', message: 'Failed to fetch claimed jobs' })
    }

    // 4. Process each artist
    const results: Array<{ jobId: string; artistName: string; status: string; email?: string }> = []

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i] as any
      const artist = job.artists

      if (!artist) {
        await supabase
          .from('enrichment_queue')
          .update({ status: 'failed', error_message: 'Artist not found', completed_at: new Date().toISOString() })
          .eq('id', job.id)
        await supabase.rpc('increment_batch_counter', { p_batch_id: activeBatch.id, p_field: 'failed', p_email_found: 0 })
        results.push({ jobId: job.id, artistName: 'unknown', status: 'failed' })
        continue
      }

      // Check qualification gate
      if (artist.qualification_status === 'not_qualified') {
        await supabase
          .from('enrichment_queue')
          .update({ status: 'skipped', error_message: `Not qualified: ${artist.qualification_reason || 'N/A'}`, completed_at: new Date().toISOString() })
          .eq('id', job.id)
        await supabase.rpc('increment_batch_counter', { p_batch_id: activeBatch.id, p_field: 'skipped', p_email_found: 0 })
        results.push({ jobId: job.id, artistName: artist.name, status: 'skipped' })
        continue
      }

      // Safety: check remaining time (leave 30s buffer)
      const elapsed = Date.now() - startTime
      if (elapsed > 250_000) {
        // Put job back to pending so next invocation picks it up
        await supabase
          .from('enrichment_queue')
          .update({ status: 'pending', started_at: null })
          .eq('id', job.id)
        console.log(`[Cron] Timeout approaching after ${elapsed}ms, releasing remaining jobs`)
        break
      }

      try {
        console.log(`[Cron] Processing ${i + 1}/${jobs.length}: ${artist.name}`)
        const result = await enrichAndSave({ supabase, artist, runBy: 'cron-worker' })

        const emailFound = result.email_found ? 1 : 0

        await supabase
          .from('enrichment_queue')
          .update({
            status: 'completed',
            email_found: result.email_found || null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        await supabase.rpc('increment_batch_counter', {
          p_batch_id: activeBatch.id,
          p_field: 'completed',
          p_email_found: emailFound,
        })

        results.push({ jobId: job.id, artistName: artist.name, status: 'completed', email: result.email_found || undefined })
      } catch (error: any) {
        console.error(`[Cron] Error enriching ${artist.name}:`, error.message)

        const attempts = (job.attempts || 0) + 1
        const newStatus = attempts >= (job.max_attempts || 3) ? 'failed' : 'pending'

        await supabase
          .from('enrichment_queue')
          .update({
            status: newStatus,
            attempts,
            error_message: error.message?.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        if (newStatus === 'failed') {
          await supabase.rpc('increment_batch_counter', {
            p_batch_id: activeBatch.id,
            p_field: 'failed',
            p_email_found: 0,
          })
        }

        results.push({ jobId: job.id, artistName: artist.name, status: newStatus })
      }

      // Delay between artists
      if (i < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ARTISTS_MS))
      }
    }

    // 5. Check if batch is now complete
    const { count: remaining } = await supabase
      .from('enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', activeBatch.id)
      .in('status', ['pending', 'processing'])

    if (remaining === 0) {
      await supabase
        .from('enrichment_batches')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', activeBatch.id)
    }

    return NextResponse.json({
      status: 'processed',
      batchId: activeBatch.id,
      processed: results.length,
      results,
      elapsedMs: Date.now() - startTime,
      remainingInBatch: remaining,
    })
  } catch (error: any) {
    console.error('[Cron] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
