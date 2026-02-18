import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { batchId, action } = await request.json()

    if (!batchId || !action) {
      return NextResponse.json({ error: 'batchId and action required' }, { status: 400 })
    }

    const { data: batch } = await supabase
      .from('enrichment_batches')
      .select('*')
      .eq('id', batchId)
      .single()

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    switch (action) {
      case 'pause': {
        if (!['processing', 'queued'].includes(batch.status)) {
          return NextResponse.json({ error: `Cannot pause batch in ${batch.status} state` }, { status: 400 })
        }
        await supabase
          .from('enrichment_batches')
          .update({ status: 'paused' })
          .eq('id', batchId)
        return NextResponse.json({ status: 'paused', batchId })
      }

      case 'resume': {
        if (batch.status !== 'paused') {
          return NextResponse.json({ error: `Cannot resume batch in ${batch.status} state` }, { status: 400 })
        }
        await supabase
          .from('enrichment_batches')
          .update({ status: 'processing' })
          .eq('id', batchId)
        return NextResponse.json({ status: 'processing', batchId })
      }

      case 'cancel': {
        if (['completed', 'cancelled'].includes(batch.status)) {
          return NextResponse.json({ error: `Batch already ${batch.status}` }, { status: 400 })
        }
        // Count remaining jobs first
        const { count: skippedCount } = await supabase
          .from('enrichment_queue')
          .select('id', { count: 'exact', head: true })
          .eq('batch_id', batchId)
          .in('status', ['pending', 'processing'])

        // Mark them as skipped
        await supabase
          .from('enrichment_queue')
          .update({ status: 'skipped', error_message: 'Batch cancelled by user', completed_at: new Date().toISOString() })
          .eq('batch_id', batchId)
          .in('status', ['pending', 'processing'])

        await supabase
          .from('enrichment_batches')
          .update({
            status: 'cancelled',
            skipped: (batch.skipped || 0) + (skippedCount || 0),
            completed_at: new Date().toISOString(),
          })
          .eq('id', batchId)

        return NextResponse.json({ status: 'cancelled', batchId, skippedJobs: skippedCount })
      }

      case 'retry_failed': {
        // Count failed jobs first
        const { count: retryCount } = await supabase
          .from('enrichment_queue')
          .select('id', { count: 'exact', head: true })
          .eq('batch_id', batchId)
          .eq('status', 'failed')

        // Reset them to pending
        await supabase
          .from('enrichment_queue')
          .update({ status: 'pending', error_message: null, attempts: 0, updated_at: new Date().toISOString() })
          .eq('batch_id', batchId)
          .eq('status', 'failed')

        // If batch was completed, set it back to processing
        if (['completed', 'cancelled'].includes(batch.status) && (retryCount || 0) > 0) {
          await supabase
            .from('enrichment_batches')
            .update({
              status: 'processing',
              failed: Math.max(0, (batch.failed || 0) - (retryCount || 0)),
            })
            .eq('id', batchId)
        }

        return NextResponse.json({ status: 'retrying', batchId, retriedJobs: retryCount })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[Batch Control] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
