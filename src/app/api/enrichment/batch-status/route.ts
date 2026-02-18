import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const batchId = request.nextUrl.searchParams.get('batchId')

    if (batchId) {
      // Single batch detail
      const { data: batch } = await supabase
        .from('enrichment_batches')
        .select('*')
        .eq('id', batchId)
        .single()

      if (!batch) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      }

      // Get queue status breakdown via individual counts
      const statuses = ['pending', 'processing', 'completed', 'failed', 'skipped'] as const
      const statusCounts: Record<string, number> = {}

      for (const status of statuses) {
        const { count } = await supabase
          .from('enrichment_queue')
          .select('id', { count: 'exact', head: true })
          .eq('batch_id', batchId)
          .eq('status', status)
        statusCounts[status] = count || 0
      }

      return NextResponse.json({ batch, statusCounts })
    }

    // List all batches (most recent first)
    const { data: batches } = await supabase
      .from('enrichment_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ batches: batches || [] })
  } catch (error: any) {
    console.error('[Batch Status] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
