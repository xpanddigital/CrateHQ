import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyReply } from '@/lib/ai/sdr'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { replyText, conversationHistory } = await request.json()

    if (!replyText) {
      return NextResponse.json({ error: 'Reply text is required' }, { status: 400 })
    }

    const classification = await classifyReply(replyText, conversationHistory)

    return NextResponse.json(classification)
  } catch (error: any) {
    console.error('Error classifying reply:', error)
    return NextResponse.json(
      { error: error.message || 'Classification failed' },
      { status: 500 }
    )
  }
}
