import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFollowup } from '@/lib/ai/sdr'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { artistData, daysSinceLastContact, scoutProfile, conversationHistory } = await request.json()

    if (!artistData || daysSinceLastContact === undefined) {
      return NextResponse.json(
        { error: 'Artist data and days since last contact are required' },
        { status: 400 }
      )
    }

    const followup = await generateFollowup(
      artistData,
      daysSinceLastContact,
      scoutProfile || {},
      conversationHistory
    )

    return NextResponse.json(followup)
  } catch (error: any) {
    console.error('Error generating followup:', error)
    return NextResponse.json(
      { error: error.message || 'Followup generation failed' },
      { status: 500 }
    )
  }
}
