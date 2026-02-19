import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAgentAuth } from '@/lib/dm/auth'

export async function GET(request: NextRequest) {
  try {
    const igAccountId = request.nextUrl.searchParams.get('ig_account_id')

    const auth = await verifyAgentAuth(
      request.headers.get('authorization'),
      igAccountId
    )
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data: messages, error } = await supabase
      .from('pending_outbound_messages')
      .select('id, ig_thread_id, message_text')
      .eq('ig_account_id', igAccountId!)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[DM-Agent] Pending replies error:', error)
      return NextResponse.json({ error: 'Failed to fetch pending messages' }, { status: 500 })
    }

    return NextResponse.json({
      messages: (messages || []).map(m => ({
        id: m.id,
        thread_id: m.ig_thread_id,
        message_text: m.message_text,
      })),
    })
  } catch (error) {
    console.error('[DM-Agent] Pending replies unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
