import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReply } from '@/lib/ai/sdr'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { replyText, artistData, scoutProfile, classification, conversationHistory } = await request.json()

    if (!replyText || !artistData) {
      return NextResponse.json(
        { error: 'Reply text and artist data are required' },
        { status: 400 }
      )
    }

    const generatedReply = await generateReply(
      replyText,
      artistData,
      scoutProfile || {},
      classification,
      conversationHistory
    )

    return NextResponse.json(generatedReply)
  } catch (error: any) {
    console.error('Error generating reply:', error)
    return NextResponse.json(
      { error: error.message || 'Reply generation failed' },
      { status: 500 }
    )
  }
}
